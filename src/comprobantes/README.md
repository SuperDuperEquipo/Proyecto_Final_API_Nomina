# Módulo de Comprobantes y Reportes

Genera el comprobante de pago individual de cada empleado (salario, aguinaldo, vacaciones) a partir del `DetalleNomina` ya calculado y persistido, y produce reportes gerenciales comparativos entre períodos. Este módulo **no recalcula** nada: solo lee y presenta lo que la nómina ya dejó sellado al cerrarse o aprobarse, de modo que un comprobante siempre refleja exactamente lo que se aprobó.

## Información General

- **Directorio del Módulo:** `src/comprobantes/`

---

## Endpoints Expuestos

Todos los endpoints están protegidos por `JwtAuthGuard` + `RolesGuard`. Requieren cabecera `Authorization: Bearer <JWT_TOKEN>`.

### 1. Consultar comprobante individual
- **Ruta:** `GET /comprobantes/nomina/:nominaId/empleado/:empleadoId`
- **Permisos:** `ADMIN`, `RECURSOS_HUMANOS` y `EMPLEADO` **(un `EMPLEADO` solo puede consultar el suyo propio)**.
- **Precondición:** la nómina debe estar `CERRADA` o `APROBADA` (ver decisión #1).
- **Respuestas:**
  - `200 OK`: comprobante tipado según el tipo de nómina — `SALARIO`, `AGUINALDO`, `VACACIONES`, o el subtipo especial genérico.
  - `403 Forbidden`: un `EMPLEADO` intenta ver el comprobante de otra persona.
  - `404 Not Found`: nómina, empleado o detalle inexistente.
  - `409 Conflict`: la nómina todavía está `ABIERTA`.

### 2. Listar comprobantes de una nómina
- **Ruta:** `GET /comprobantes/nomina/:nominaId`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Precondición:** la nómina debe estar `CERRADA` o `APROBADA`.
- **Respuestas:** `200 OK` con la lista de `DetalleNomina` del período / `404` / `409`.

### 3. Reporte comparativo por área
- **Ruta:** `GET /comprobantes/reportes/comparativo?periodoActual=AAAA-MM-Q1&periodoAnterior=AAAA-MM-Q2`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Efecto:** compara dos nóminas **`REGULAR`** `CERRADA`/`APROBADA`, agregando por `area` el total devengado, total de deducciones y líquido a pagar, con sus variaciones absolutas y porcentuales.
- **Respuestas:** `200 OK` / `404` si no existe una nómina regular procesada para alguno de los períodos / `409` si ambos períodos son iguales o la nómina no tiene detalles.

---

## Decisiones de Negocio y su Justificación

1. **El comprobante solo existe cuando la nómina está `CERRADA` o `APROBADA`:** mientras la nómina está `ABIERTA` no hay `DetalleNomina` confiable (aún pueden entrar/editarse novedades). Entregar un recibo de un cálculo provisional induciría a error al trabajador, por eso se bloquea con `409`. El comprobante documenta el pago efectivamente devengado.
   - *Base legal:* obligación patronal de documentar y entregar constancia del pago del salario y su desglose (Código de Trabajo — **confirmar artículo exacto**, se toma como base la obligación general de constancia de pago). Se apoya además en la inmutabilidad de lo aprobado (**Art. 53 romano I CT**): el comprobante refleja lo aprobado, no un valor recalculado.

2. **Un `EMPLEADO` solo puede ver su propio comprobante (`validarAccesoPropio`):** la remuneración de un trabajador es dato personal y confidencial; un `EMPLEADO` autenticado no debe poder consultar el recibo de un compañero. `ADMIN` y `RECURSOS_HUMANOS` sí pueden consultar el de cualquiera por su función administrativa.
   - *Base:* principio de confidencialidad de datos personales / salariales. Ver también el hallazgo de seguridad sobre exposición de datos en el endpoint de listado (abajo).

3. **El comprobante se arma tipado según el tipo/subtipo de nómina:** una nómina `REGULAR` produce un comprobante de `SALARIO` (ingresos: salario base, horas extra, bonificaciones; deducciones: ISSS, AFP, ISR, otros descuentos). `AGUINALDO` y `VACACIONES` se presentan como **prestación** (no como salario ordinario), con su propio desglose, porque legalmente no son lo mismo que el salario del período. Así el recibo comunica el concepto jurídico correcto de cada pago.

4. **El módulo lee el `DetalleNomina` persistido, no recalcula:** garantiza que el comprobante y el reporte reflejen exactamente las cifras selladas al cerrar/aprobar, con las tasas de ISSS/AFP/ISR vigentes en ese momento — no con las de hoy. Es la contraparte de lectura de la decisión de versionado del módulo `deducciones` y de la inmutabilidad del módulo `nomina`.

5. **El reporte comparativo excluye nóminas `ABIERTA` y solo agrega `REGULAR`:** comparar datos no confirmados (aún editables) daría un reporte inestable; y mezclar pagos especiales (aguinaldo/vacaciones) con la planilla ordinaria distorsionaría la comparación de costo laboral por área entre dos quincenas.

---

## Casos Borde Considerados

- **Nómina `ABIERTA`:** ambos endpoints de comprobante devuelven `409` en vez de exponer un cálculo provisional.
- **Empleado sin detalle en esa nómina:** `404` (p. ej. un empleado excluido de una Quincena 25 por ganar más de $1,500 no tiene comprobante de ese pago).
- **`EMPLEADO` consultando a otro empleado:** `403`.
- **Períodos iguales en el comparativo:** `409`.
- **Área nula:** el agregado usa `'Sin área'` como llave por defecto para no perder filas.
- **División por cero en la variación porcentual:** si el líquido anterior es `0`, `porcentajeLiquido` se devuelve como `null` en vez de `Infinity`/`NaN`.

---

## Limitaciones Conocidas / Nota de Seguridad

- **Exposición del hash de contraseña (pendiente de corregir):** `listarComprobantesDeNomina` (endpoint #2) devuelve `DetalleNomina[]` con la relación `empleado` cargada completa. Como la columna `password` de `Empleado` no está marcada como `select: false`, el hash **bcrypt** viaja en la respuesta. La corrección recomendada es marcar `password` con `select: false` en la entidad (afecta también a `GET /nomina/:id/detalle`). Ver informe de revisión de seguridad, hallazgo **C2**.
- **No genera PDF ni firma electrónica:** el comprobante se entrega como JSON. Si la defensa/uso real exige una boleta imprimible o firmada, es trabajo futuro.

---

## Dependencias con Otros Módulos

- **Depende de:**
  - **Nómina:** entidades `Nomina` y `DetalleNomina` (fuente de todos los datos que presenta).
  - **Empleados:** entidad `Empleado` (nombre, documento, cargo, área para encabezar el comprobante y agrupar el reporte).
- **A quién le sirve:** es el punto final de consumo de la cadena Empleados → Novedades → Nómina → Deducciones; entrega al trabajador y a RR. HH. el resultado legible.

---

## Pruebas Unitarias

```bash
npm run test -- src/comprobantes
```
