# Módulo de Nómina

Gestiona el ciclo de vida de una planilla (`Nomina`): apertura, cálculo del desglose por empleado al cerrarla, reapertura para corregir novedades, y aprobación final e irreversible. Para nóminas `REGULAR` corre el motor de cálculo (`NominaCalculoService`) que combina salario base prorrateado, novedades del período (horas extra, permisos, bonificaciones, descuentos) y las deducciones de ley (ISSS, AFP, ISR) para producir un `DetalleNomina` por empleado.

## Información General

- **Directorio del Módulo:** `src/nomina/`

---

## Endpoints Expuestos

Todos los endpoints están protegidos por `JwtAuthGuard` + `RolesGuard`. Requieren cabecera `Authorization: Bearer <JWT_TOKEN>`.

### 1. Crear período de nómina
- **Ruta:** `POST /nomina`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo (DTO):** `CreateNominaDto`
  ```json
  {
    "periodo": "2026-07-Q2",
    "tipo": "REGULAR"
  }
  ```
- **Respuestas:**
  - `201 Created`: nómina creada en estado `ABIERTA`.
  - `400 Bad Request`: `periodo` con formato inválido, o `subtipoEspecial` incoherente con `tipo` (ver decisión #2).

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
- **Efecto:** `ABIERTA -> CERRADA`. Para `tipo = REGULAR` corre `NominaCalculoService.calcularPeriodoRegular` y persiste el detalle; para `ESPECIAL` solo cambia de estado (ver limitación conocida más abajo).
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
9. **Nómina `ESPECIAL` (Quincena 25, Aguinaldo) validada pero no calculada todavía:** `cerrar()` solo cambia el estado a `CERRADA` para este tipo, sin invocar el motor de cálculo. Ver limitación conocida abajo.

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

---

## Limitaciones Conocidas / Trabajo Futuro

- **Nómina `ESPECIAL` (Quincena 25, Aguinaldo) sin motor de cálculo:** el tipo y su `subtipoEspecial` ya están modelados y validados a nivel de DTO/entidad, pero `calcularPeriodoRegular` solo corre para `tipo = REGULAR`. Cada subtipo especial tiene reglas de elegibilidad y exención propias (distintas entre Quincena 25 y Aguinaldo) que quedan fuera del alcance de esta fase; `cerrar()` para `ESPECIAL` únicamente cambia de estado.
- **Subsidio de `LICENCIA_MATERNIDAD`:** para calcularlo con exactitud, `novedades` necesitaría capturar el monto del subsidio (o los días cubiertos) en vez de solo el tipo de la novedad. Ver decisión #8 y la limitación equivalente en `src/deducciones/README.md`.

---

## Dependencias con Otros Módulos

- **Depende de:**
  - **Empleados:** `Empleado` (salario base, fecha de ingreso) e `HistorialSalario` (cambios de salario) para prorratear el devengado.
  - **Novedades:** consulta `Novedad` por `empleadoId`/`nominaId` para sumar horas extra, permisos sin goce, bonificaciones y descuentos al cerrar la planilla.
  - **Deducciones:** `ClasificacionDeduccionesService`, `ConfiguracionVigenteService`, `IsssAfpCalculoService` e `IsrCalculoService` para clasificar novedades y calcular ISSS, AFP e ISR.
- **A quién le sirve:**
  - **Comprobantes:** consumirá `GET /nomina/:id/detalle` de una nómina `APROBADA` para generar los recibos de pago.

---

## Pruebas Unitarias

```bash
npm run test -- src/nomina
```
