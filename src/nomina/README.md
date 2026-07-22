# Módulo de Nómina

Gestiona el ciclo de vida de una planilla (`Nomina`): apertura, cálculo del desglose por empleado al cerrarla, reapertura para corregir novedades, y aprobación final e irreversible. `NominaCalculoService` corre uno de dos motores de cálculo según `tipo`: para `REGULAR`, combina salario base prorrateado, novedades del período (horas extra, permisos, bonificaciones, descuentos) y las deducciones de ley (ISSS, AFP, ISR); para `ESPECIAL` (Quincena 25, Aguinaldo), calcula el pago puntual a partir del salario y la antigüedad del empleado. Ambos motores producen un `DetalleNomina` por empleado. Ver decisión #11 sobre por qué Aguinaldo se calcula aquí y no en P5, pese a que el documento de consultoría cita su fórmula legal bajo el Sector 5.

## Información General

- **Directorio del Módulo:** `src/nomina/`

---

## Endpoints Expuestos

Todos los endpoints están protegidos por `JwtAuthGuard` + `RolesGuard`. Requieren cabecera `Authorization: Bearer <JWT_TOKEN>`.

### 1. Crear período de nómina
- **Ruta:** `POST /nomina`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo (DTO):** `CreateNominaDto`. El formato de `periodo` y su ventana válida dependen de `tipo`/`subtipoEspecial` (ver decisión #9):
  ```json
  { "periodo": "2026-07-Q2", "tipo": "REGULAR" }
  ```
  ```json
  { "periodo": "2026-01-20", "tipo": "ESPECIAL", "subtipoEspecial": "QUINCENA_25" }
  ```
  ```json
  { "periodo": "2026-12-01", "tipo": "ESPECIAL", "subtipoEspecial": "AGUINALDO" }
  ```
- **Respuestas:**
  - `201 Created`: nómina creada en estado `ABIERTA`.
  - `400 Bad Request`: `periodo` con formato inválido o fuera de la ventana legal para el `tipo`/`subtipoEspecial` enviado, o `subtipoEspecial` incoherente con `tipo` (ver decisiones #2 y #9).

### 2. Listar nóminas
- **Ruta:** `GET /nomina`
- **Permisos:** Cualquier usuario autenticado.
- **Query params opcionales:** `estado`, `tipo`, `periodo`.
- **Respuestas:** `200 OK` con la lista filtrada, ordenada por `id` descendente.

### 3. Obtener una nómina por ID
- **Ruta:** `GET /nomina/:id`
- **Permisos:** Cualquier usuario autenticado.
- **Respuestas:** `200 OK` / `404 Not Found`.

### 4. Obtener el desglose por empleado
- **Ruta:** `GET /nomina/:id/detalle`
- **Permisos:** Cualquier usuario autenticado.
- **Respuestas:** `200 OK` con la lista de `DetalleNomina` (vacía si la nómina aún no se ha cerrado) / `404 Not Found`.

### 5. Cerrar una nómina
- **Ruta:** `PATCH /nomina/:id/cerrar`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Efecto:** `ABIERTA -> CERRADA`. Para `tipo = REGULAR` corre `NominaCalculoService.calcularPeriodoRegular`; para `ESPECIAL` corre `calcularNominaEspecial` (Quincena 25 o Aguinaldo según `subtipoEspecial`). Ambos persisten el detalle por empleado.
- **Respuestas:** `200 OK` / `404 Not Found` / `409 Conflict` si no está `ABIERTA`.

### 6. Reabrir una nómina
- **Ruta:** `PATCH /nomina/:id/reabrir`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Efecto:** `CERRADA -> ABIERTA`, para permitir corregir novedades antes de aprobar.
- **Respuestas:** `200 OK` / `404 Not Found` / `409 Conflict` si no está `CERRADA` o si ya está `APROBADA`.

### 7. Aprobar una nómina
- **Ruta:** `PATCH /nomina/:id/aprobar`
- **Permisos:** Solo `ADMIN`.
- **Efecto:** `CERRADA -> APROBADA`, sella `fechaAprobacion`. Acción final: no existe transición de regreso desde `APROBADA` en este servicio.
- **Respuestas:** `200 OK` / `404 Not Found` / `409 Conflict` si no está `CERRADA` o si ya está `APROBADA`.

### 8. Eliminar una nómina
- **Ruta:** `DELETE /nomina/:id`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Respuestas:** `200 OK` / `404 Not Found` / `409 Conflict` si no está `ABIERTA`.

---

## Decisiones de Negocio y su Justificación

1. **Ciclo de vida `ABIERTA -> CERRADA -> APROBADA`, con retroceso único `CERRADA -> ABIERTA`:** una vez `APROBADA` la nómina es inmutable (no hay `reabrir` ni `aprobar` de vuelta). Reducir retroactivamente un pago ya devengado da al trabajador derecho a terminar el contrato con responsabilidad patronal (Art. 53.I Código de Trabajo), así que el servicio no expone ninguna ruta de retroceso desde `APROBADA`.
2. **`subtipoEspecial` obligatorio solo para `tipo = ESPECIAL`, rechazado para `REGULAR`:** validado con un decorador propio (`RequeridoSoloParaTipos` en `create-nomina.dto.ts`), siguiendo el mismo patrón que `novedades` usa para sus campos condicionales, para no aceptar combinaciones incoherentes en silencio.
3. **Solo `RECURSOS_HUMANOS`/`ADMIN` administran el ciclo de vida, pero `aprobar` es exclusivo de `ADMIN`:** aprobar es el punto sin retorno (Art. 53.I), así que se restringe a un solo rol en vez de los dos que manejan el resto del ciclo.
4. **El motor de cálculo borra el detalle previo antes de recalcular (`calcularPeriodoRegular`):** para que `reabrir` → corregir una novedad → `cerrar` de nuevo no deje filas duplicadas ni huérfanas del intento anterior.
5. **Prorrateo por tramos salariales:** el período se divide en tramos usando `HistorialSalario` (cambios de salario a mitad de período) y la `fechaIngreso` del empleado (si entró a mitad de período); cada tramo se paga a `salario/30` por día. Empleados contratados después del fin del período quedan excluidos de la nómina.
6. **Clasificación de novedades delegada a `ClasificacionDeduccionesService` (módulo `deducciones`):** este módulo no decide por sí mismo si una `HORAS_EXTRA` o `BONIFICACION` cuenta para las bases de ISSS/AFP/ISR; reutiliza el mismo servicio que ya centraliza esa regla para mantener una sola fuente de verdad entre módulos.
7. **`DESCUENTO` se resta del líquido a pagar, nunca de las bases ISSS/AFP/ISR; `PERMISO_SIN_GOCE` resta días de devengado, no un monto de deducción:** consistente con la decisión #8 documentada en el README de `deducciones`.
8. **`LICENCIA_MATERNIDAD` no aporta un monto adicional en el cálculo actual (gap de modelo conocido):** el modelo de `Novedad` no captura un monto de subsidio para este tipo. Su salario ordinario del período igual se paga con normalidad porque, a diferencia de `PERMISO_SIN_GOCE`, ninguna novedad de este tipo resta del devengado; lo que falta es la lógica de subsidio ISSS documentada en el README de `deducciones` (decisión #7), pendiente de que `novedades` capture ese monto.
9. **`periodo` tiene dos formatos según `tipo`, y cada `subtipoEspecial` valida además su propia ventana legal:** `AAAA-MM-Q1/Q2` para `REGULAR` (un ciclo quincenal recurrente); `AAAA-MM-DD` para `ESPECIAL` (la fecha de pago puntual), validada además contra la ventana de ley del subtipo: **15–25 de enero** para Quincena 25 (Ley Especial, D.L. 499/2026) y **20 de octubre–20 de diciembre** para Aguinaldo (Art. 200 CT, reforma 2025). No se reutilizó el formato quincenal para `ESPECIAL` porque ninguno de los dos pagos es una quincena; y la ventana se valida en el DTO (no solo se documenta) porque el Sector 4 de la consultoría la presenta como "fijo por ley", no como decisión de negocio — igual que el sistema debe bloquear un salario bajo el mínimo en el módulo de empleados.
10. **Quincena 25 (Ley Especial, Decreto Legislativo 499, enero 2026): 50% del salario nominal, exclusiva para salario ≤ $1,500/mes, exenta de ISSS/AFP/ISR:** `calcularNominaEspecial` excluye directamente (no incluye con monto $0) a los empleados con `salarioBase` por encima del tope, igual que `calcularPeriodoRegular` excluye a quien aún no ha sido contratado. No se prorratea por antigüedad: la ley no lo pide, es un monto fijo para quien califica.
11. **Aguinaldo SÍ se calcula en P4, no solo Quincena 25 — nota de honestidad metodológica sobre esta decisión:** el documento de consultoría no es inequívoco sobre a quién le toca la fórmula de Aguinaldo. El Sector 4 (P4) titula su alcance explícitamente como *"...nóminas especiales"* y usa Quincena 25 como ejemplo completo de por qué esa función existe; el Sector 5 (P5, "Comprobantes, **prestaciones proporcionales** y reportes") es donde aparece citada la fórmula completa de Aguinaldo (Art. 196–202 CT). Se interpretó que esa cita bajo Sector 5 evita repetir el mismo texto legal dos veces en el documento, no que le quite a P4 la responsabilidad de calcular una de sus propias "nóminas especiales": Aguinaldo (Art. 196–198 CT: 15/19/21 días según antigüedad, proporcional antes del año — Art. 197) se calcula aquí igual que Quincena 25, reutilizando `salarioBase/30` como valor del día (misma convención que `REGULAR`, para no introducir una segunda definición de "día de salario"). **Se recomienda confirmar este reparto con quien lleve P5 antes de la defensa**, para que ambos den la misma respuesta si el experto pregunta quién calculó el aguinaldo.
12. **ISR del Aguinaldo: exento hasta $1,500 (reforma 2025), se grava solo el exceso con la tabla progresiva vigente; Quincena 25 está completamente exenta de ISR:** no se encontró una tabla de retención específica para aguinaldo distinta de la de salario ordinario, así que se reutiliza `IsrCalculoService` sobre `monto − 1500`. **Nota de honestidad metodológica:** el mecanismo exacto (si el exceso se grava aislado o junto al salario ordinario del mes) no está confirmado contra una fuente primaria — verificar con el Ministerio de Hacienda antes de la defensa.
13. **Ambos tipos de nómina ESPECIAL quedan exentos de ISSS y AFP en su totalidad (`baseIsss = baseAfp = 0`):** el Sector 2 de la consultoría confirma que aguinaldo y Quincena 25 no cotizan ISSS/AFP; a diferencia del ISR, ninguna fuente revisada menciona un tope parcial para estas dos cotizaciones en ninguno de los dos pagos, así que se modelan como 100% exentos en vez de aplicar un umbral parcial no verificado.
14. **`ESPECIAL` no consulta `Novedad`:** a diferencia de `REGULAR`, el motor de cálculo especial no suma horas extra, bonificaciones ni descuentos del período — Quincena 25 y Aguinaldo se calculan solo a partir de salario y antigüedad. Esto también protege el carácter "inembargable" de Quincena 25 (Sector 4): ningún `DESCUENTO` disciplinario puede aplicarse contra ese pago porque el motor de cálculo ni siquiera lo consulta.
15. **No existe una regla de exclusividad entre una nómina `ESPECIAL` y una `REGULAR` `ABIERTA` al mismo tiempo:** `create()` no lo valida en ningún sentido, así que hoy pueden coexistir. Es una decisión por omisión, no una prohibición ni una garantía explícita: una empresa podría necesitar cerrar el Aguinaldo de diciembre mientras la quincena regular del mes sigue abierta, y no hay motivo legal para bloquear eso.

---

## Casos Borde Considerados

- **Cálculo del rango de un período (`obtenerRangoPeriodo`):** `Q1` cubre los días 1–15; `Q2` cubre del 16 al último día del mes, incluyendo meses de 28/29/30/31 días (probado explícitamente para febrero). Un formato de `periodo` inválido lanza error.
- **Nómina sin empleados vigentes:** devuelve un arreglo vacío y evita consultar la configuración de deducciones vigente (no tiene sentido buscarla si no hay a quién aplicarla).
- **Empleado contratado a mitad de período:** el tramo salarial arranca en su `fechaIngreso`, no en el inicio del período.
- **Empleado aún no contratado al cierre del período:** excluido de la nómina (filtrado por `fechaIngreso <= fechaFin`).
- **Cambio de salario a mitad de período:** se prorratea usando `HistorialSalario`, generando un tramo por cada tasa vigente.
- **Recalcular tras `reabrir`:** no deja filas de `DetalleNomina` duplicadas ni huérfanas del cálculo anterior (se borran primero).
- **Multiplicador de horas extra por subtipo:** verificado para todos los subtipos definidos en `SubtipoHoraExtra`, incluyendo el caso límite `ASUETO_NOCTURNA` (×6.0).
- **Bonificación habitual vs. ocasional:** una bonificación con `afectaBasePrestaciones = true` entra a las tres bases (ISSS, AFP, ISR); una ocasional queda fuera de ISSS/AFP pero cuenta para ISR.
- **`LICENCIA_MATERNIDAD` sin monto:** no suma nada al devengado (ver decisión #8); cubierto explícitamente con un test que documenta el gap.
- **Nunca reabrir ni aprobar dos veces una nómina `APROBADA`:** ambas rutas lanzan `409 Conflict`.
- **`aprobar` exige `CERRADA` primero:** una nómina todavía `ABIERTA` no puede aprobarse directamente.
- **Quincena 25 excluye a quien gana más de $1,500:** no aparece en el detalle con monto $0, simplemente no se genera su fila.
- **Quincena 25 sin ningún empleado elegible:** devuelve un arreglo vacío, igual que `REGULAR` sin empleados vigentes.
- **Ventana de pago de Quincena 25:** acepta el 15 y el 25 de enero (límites inclusive) y cualquier fecha entre medio; rechaza el 14 de enero, el 26 de enero y cualquier fecha fuera de enero.
- **Ventana de pago de Aguinaldo:** acepta el 20 de octubre y el 20 de diciembre (límites inclusive); rechaza el 19 de octubre, el 21 de diciembre y fechas fuera de esa ventana.
- **Aguinaldo en cada tramo de antigüedad:** verificado para 1–3 años (15 días), 3–10 años (19 días) y 10+ años (21 días).
- **Aguinaldo con menos de un año de antigüedad:** prorrateado por días trabajados sobre 365 usando la tasa del primer tramo (Art. 197).
- **Aguinaldo por debajo del umbral de $1,500:** ISR = $0, sin necesidad de que la base gravable llegue a ser negativa.
- **Aguinaldo por encima de $1,500:** solo el excedente entra a `IsrCalculoService`, no el monto completo.
- **Ambos pagos especiales nunca generan `baseIsss`/`baseAfp` mayores a $0.**

---

## Limitaciones Conocidas / Trabajo Futuro

- **Subsidio de `LICENCIA_MATERNIDAD`:** para calcularlo con exactitud, `novedades` necesitaría capturar el monto del subsidio (o los días cubiertos) en vez de solo el tipo de la novedad. Ver decisión #8 y la limitación equivalente en `src/deducciones/README.md`.
- **Reparto P4/P5 del cálculo de Aguinaldo no confirmado con el equipo (ver decisión #11):** se implementó en P4 por una lectura razonada del documento de consultoría, no por una instrucción inequívoca. Si quien lleva P5 ya construyó (o va a construir) su propio cálculo de Aguinaldo, hay riesgo de lógica duplicada o inconsistente entre ambos módulos — coordinar antes de la defensa.
- **Mecanismo exacto del ISR sobre el exceso del Aguinaldo no verificado contra fuente primaria:** ver decisión #12. Se aplica la tabla progresiva de `IsrCalculoService` sobre `monto − 1500`, pero no se confirmó si el Ministerio de Hacienda trata ese excedente de forma aislada o acumulada con el salario ordinario del mes de pago.
- **Sin regla de exclusividad entre `ESPECIAL` y `REGULAR` abiertas simultáneamente:** ver decisión #15. Es el comportamiento actual por ausencia de validación, no una decisión de negocio confirmada; si el equipo decide bloquear (o exigir) la coexistencia, se implementaría como una verificación adicional en `NominaService.create`.
- **Antigüedad para Aguinaldo usa `365.25` días/año de forma continua, sin anclarse a un año calendario o aniversario fijo de contratación:** suficiente para las reglas de negocio actuales, pero no se validó contra un caso de auditoría real con años bisiestos en el límite exacto de un tramo.
- **Qué pasa si la fecha de pago de un `ESPECIAL` cae en día no hábil:** no se ajusta automáticamente al día hábil anterior. El Sector 4 de la consultoría marca esto como costumbre/política de empresa, no como mandato legal único, así que quedó fuera de la validación de ventana (decisión #9) — sí conviene tener la respuesta lista para la defensa.

---

## Dependencias con Otros Módulos

- **Depende de:**
  - **Empleados:** `Empleado` (salario base, fecha de ingreso) e `HistorialSalario` (cambios de salario) para prorratear el devengado.
  - **Novedades:** consulta `Novedad` por `empleadoId`/`nominaId` para sumar horas extra, permisos sin goce, bonificaciones y descuentos al cerrar la planilla.
  - **Deducciones:** `ClasificacionDeduccionesService`, `ConfiguracionVigenteService`, `IsssAfpCalculoService` e `IsrCalculoService` para clasificar novedades y calcular ISSS, AFP e ISR.
- **A quién le sirve:**
  - **Comprobantes:** consumirá `GET /nomina/:id/detalle` de una nómina `APROBADA` para generar los recibos de pago.
- **Por confirmar con P5:** este módulo calcula el monto de Aguinaldo (ver decisión #11), aunque su fórmula legal está citada en la consultoría bajo el Sector 5 ("prestaciones proporcionales"). Antes de la defensa, confirmar con quien lleve P5 que no hay una implementación paralela o distinta ahí.

---

## Pruebas Unitarias

```bash
npm run test -- src/nomina
```
