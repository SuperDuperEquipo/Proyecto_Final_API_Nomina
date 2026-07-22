# Módulo de Novedades

Registra las novedades de nómina de cada empleado: horas extra, permisos sin goce, bonificaciones, descuentos y licencia de maternidad, dentro de un período de nómina abierto.

## Información General

- **Directorio del Módulo:** `src/novedades/`

---

## Endpoints Expuestos

Todos los endpoints están protegidos por `JwtAuthGuard` + `RolesGuard`. Requieren cabecera `Authorization: Bearer <JWT_TOKEN>`.

### 1. Registrar Novedad
- **Ruta:** `POST /novedades`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo (DTO):** `CreateNovedadDto`
  ```json
  {
    "empleadoId": 1,
    "nominaId": 1,
    "tipo": "HORAS_EXTRA",
    "horas": 5,
    "fecha": "2026-07-15",
    "descripcion": "Horas extra por cierre de mes"
  }
  ```
- **Respuestas:**
  - `201 Created`: Novedad registrada.
  - `404 Not Found`: El empleado o la nómina no existen.
  - `409 Conflict`: La nómina no está en estado `ABIERTA`.

### 2. Listar Novedades
- **Ruta:** `GET /novedades`
- **Permisos:** Cualquier usuario autenticado.
- **Query params opcionales:** `empleadoId`, `nominaId`, `tipo`.
- **Respuestas:** `200 OK` con la lista filtrada.

### 3. Novedades de un período
- **Ruta:** `GET /novedades/nomina/:nominaId`
- **Permisos:** Cualquier usuario autenticado.
- **Uso previsto:** que el módulo de Nómina consulte todas las novedades de un período al momento de cerrar la planilla.
- **Respuestas:** `200 OK` / `404 Not Found` si la nómina no existe.

### 4. Obtener Novedad por ID
- **Ruta:** `GET /novedades/:id`
- **Permisos:** Cualquier usuario autenticado.
- **Respuestas:** `200 OK` / `404 Not Found`.

### 5. Actualizar Novedad
- **Ruta:** `PATCH /novedades/:id`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo (DTO):** `UpdateNovedadDto` (no permite cambiar `empleadoId` ni `nominaId`).
- **Respuestas:** `200 OK` / `404 Not Found` / `409 Conflict` si la nómina ya no está abierta.

### 6. Eliminar Novedad
- **Ruta:** `DELETE /novedades/:id`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Respuestas:** `200 OK` / `404 Not Found` / `409 Conflict` si la nómina ya no está abierta.

---

## Decisiones de Negocio y su Justificación

1. **Novedades solo en nómina `ABIERTA`:** el servicio revalida el estado de la `Nomina` asociada en cada `create`, `update` y `remove` (no solo al crear), porque el período puede cerrarse entre que se registra una novedad y que alguien intenta editarla. No es un mandato legal puntual, pero se apoya en la misma lógica del Código de Trabajo: una vez que una nómina se acerca a su aprobación, modificar retroactivamente lo que un empleado va a recibir es terreno legalmente riesgoso.

2. **`horas` guarda cantidad, no monto:** para `HORAS_EXTRA` este módulo registra solo la cantidad de horas. El valor monetario depende del salario/hora del empleado y de si son horas diurnas, nocturnas o de descanso.

3. **`afectaBasePrestaciones` para distinguir salario de liberalidad:** una `BONIFICACION` habitual y recurrente es salario y debe entrar en la base de cálculo de aguinaldo y vacaciones, una liberalidad ocasional del patrono no. El campo lo decide quien registra la novedad, y el servicio lo respeta tal cual salvo para `LICENCIA_MATERNIDAD`.

4. **No se creó un tipo `COMISION` separado:** no es una de las funcionalidades explícitamente requeridas en el alcance original del proyecto (solo horas extra, permisos sin goce, bonificaciones y descuentos). Si en el futuro se necesita, se recomienda modelarla como `BONIFICACION` usando el campo `fecha` para representar la fecha en que el cliente pagó, no la fecha de la venta, y evitar sobre-diseñar el módulo para un caso no pedido.

5. **`LICENCIA_MATERNIDAD` se incluyó como extensión:** no está en la tabla de funcionalidades requeridas del proyecto, pero el Código de Trabajo protege ese período como tiempo trabajado sin reducción salarial. El servicio fuerza `afectaBasePrestaciones = false` para este tipo sin importar lo que envíe el cliente, precisamente para que nunca reste de la base de aguinaldo o vacaciones.

6. **`empleadoId` y `nominaId` no son editables:** si una novedad se registró mal, la corrección es eliminarla (mientras la nómina siga abierta) y crear una nueva, en vez de reasignarla a otro empleado o período.

7. **`RECURSOS_HUMANOS` habilitado en las mismas rutas que `ADMIN`:** se verificó en vivo (no solo por lectura de código) que el rol funciona correctamente en el módulo de Empleados (creación de empleado con RRHH autenticado → `201`), así que se mantiene el mismo criterio de permisos aquí para consistencia entre módulos.

8. **`horas`, `subtipoHoraExtra` y `monto` se rechazan cuando no aplican al `tipo` enviado:** originalmente estos campos solo eran *obligatorios* condicionalmente (vía `@ValidateIf`), pero nada impedía enviarlos junto con un tipo que no los usa — por ejemplo, mandar `monto` en una novedad `HORAS_EXTRA` se guardaba sin error aunque no tuviera sentido para ese tipo. Se corrigió con un validador personalizado (`RequeridoSoloParaTipos` en `create-novedad.dto.ts`) que exige el campo cuando el tipo lo requiere y lo rechaza (`400`) cuando no. Nota técnica: se probó primero usando dos `@ValidateIf` opuestos sobre el mismo campo (uno para exigir, otro para prohibir) y se confirmó que `class-validator` no combina condiciones así — termina saltándose toda la validación del campo. Por eso se usa un único decorador personalizado en vez de apilar `@ValidateIf`.

---

## Casos Borde Considerados

- **Nómina cerrada entre creación y edición de una novedad:** cubierto revalidando el estado en `update` y `remove`, no solo en `create` (ver test `should throw ConflictException if the linked nomina is no longer ABIERTA`).
- **Registrar `HORAS_EXTRA` sin el campo `horas`:** rechazado con `400` (ver decisión #8), `horas`/`subtipoHoraExtra` son obligatorios únicamente cuando `tipo === HORAS_EXTRA`, y `monto` únicamente para `BONIFICACION`/`DESCUENTO`.
- **Enviar `monto` en una novedad `HORAS_EXTRA` (o `horas`/`subtipoHoraExtra` en una `BONIFICACION`/`DESCUENTO`):** rechazado con `400`, ver decisión #8 y `create-novedad.dto.spec.ts`.
- **PATCH parcial que omite `tipo`:** el DTO valida de forma estateless, sin conocer el `tipo` ya guardado en base de datos. Si se envía solo `{ "monto": 20 }` sobre una novedad que ya es `DESCUENTO`, el validador trata `tipo` como indefinido y rechaza `monto` con `400`. Se debe reenviar `tipo` junto con el campo que se está editando (`{ "tipo": "DESCUENTO", "monto": 20 }`). Verificado en vivo con Postman, no solo por lectura de código.
- **Comisión registrada como bonificación con fecha de venta en vez de fecha de pago del cliente:** no se puede prevenir automáticamente (es una decisión de captura de quien registra el dato), pero queda documentado en el DTO y en este README para la defensa oral.

## Fuentes legales citadas

- Código de Trabajo, Art. 53 romano I — prohíbe modificaciones unilaterales y retroactivas del patrono sobre lo que el trabajador ya tiene derecho a recibir; base de la regla "nómina cerrada = novedad congelada".
- Código de Trabajo, Art. 113 y Art. 113-A — protección del período de licencia de maternidad como tiempo trabajado sin reducción salarial; base de forzar `afectaBasePrestaciones = false` en `LICENCIA_MATERNIDAD`.
- Código de Trabajo, Art. 119 — distinción entre salario habitual y liberalidad ocasional del patrono; base del campo `afectaBasePrestaciones`, reutilizado sin reinterpretación por el clasificador de Deducciones (P2).
- Código de Trabajo, Art. 130 regla 3ª — criterio de devengo de comisiones (fecha de pago del cliente, no fecha de venta); base de la decisión #4.
- Código de Trabajo, Art. 168 y Art. 191 — diferenciación de recargo legal entre horas extra diurnas, nocturnas y las trabajadas en día de descanso o asueto; base del enum `SubtipoHoraExtra`.

---

## Dependencias con Otros Módulos

- **Depende de:**
  - **Empleados (P1):** relación `empleadoId` contra la entidad `Empleado`, ya completa y en uso.
  - **Nómina (P4):** relación `nominaId` contra la entidad `Nomina`. Como el módulo de P4 todavía no existía al momento de crear Novedades, se creó una entidad `Nomina` mínima (`src/nomina/entities/nomina.entity.ts`) con `id`, `periodo`, `tipo` y `estado`, como contrato compartido. P4 la expandió (`subtipoEspecial`) y P5 la expandió de nuevo (`motivoVacaciones`) sin reemplazarla, por lo que esta relación nunca se rompió en ninguna integración.
- **A quién le sirve:**
  - **Nómina (P4):** consume `GET /novedades/nomina/:nominaId` para sumar horas extra, bonificaciones y descuentos al cerrar la planilla del período.
  - **Deducciones (P2):** reutiliza directamente el campo `afectaBasePrestaciones` de cada novedad para clasificar si una bonificación cuenta o no para la base de ISSS/AFP.
  - **Comprobantes (P5):** indirectamente, a través del cálculo que hace P4 con estas novedades.

---

## Pruebas Unitarias

```bash
npm run test -- src/novedades
```

Cobertura de código del proyecto completo:
```bash
npm run test:cov
```
