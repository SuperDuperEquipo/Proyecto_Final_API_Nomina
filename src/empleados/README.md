# Módulo de Empleados

Este módulo se encarga de la gestión y administración del personal dentro del sistema de nómina, incorporando normativas vigentes del Ministerio de Trabajo y Previsión Social (MTPS) de El Salvador.

## Información General
- **Responsable:** Susana Beltrán
- **Directorio del Módulo:** `src/empleados/`

---

## Endpoints Expuestos

Todos los endpoints (excepto las excepciones de roles) están protegidos mediante el guardia de autenticación JWT y de roles. Requieren una cabecera `Authorization: Bearer <JWT_TOKEN>`.

### 1. Crear Empleado
- **Ruta:** `POST /empleados`
- **Permisos:** Solo usuarios con rol `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo de la Petición (DTO):** `CreateEmpleadoDto`
  ```json
  {
    "nombre": "Juan Pérez",
    "tipoDocumento": "DUI",
    "documentoIdentidad": "00000001-2",
    "email": "juan.perez@nomina.com",
    "password": "juanito123",
    "sectorEconomico": "COMERCIO_SERVICIOS_INDUSTRIA",
    "salarioBase": 850.00,
    "cargo": "Auxiliar Contable",
    "area": "Finanzas",
    "fechaIngreso": "2026-07-15",
    "afp": "AFP Confía",
    "isss": "12345678-9",
    "rol": "EMPLEADO"
  }
  ```
- **Respuestas:**
  - `201 Created`: Devuelve el empleado creado con el ID generado (entero autoincremental), omitiendo el campo de contraseña por seguridad, e indicando si la documentación está vencida.
  - `400 Bad Request`: Datos de entrada inválidos, formato de identificación incorrecto o salario inferior al mínimo legal del sector.
  - `409 Conflict`: El Documento de Identidad o el Correo ya existen en la base de datos.

### 2. Obtener Todos los Empleados
- **Ruta:** `GET /empleados`
- **Permisos:** Cualquier usuario autenticado.
- **Respuestas:**
  - `200 OK`: Lista de empleados registrados (con alertas de plazos previsionales y contraseñas omitidas).

### 3. Obtener Estadísticas de Nacionalidad
- **Ruta:** `GET /empleados/reporte/nacionalidad`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Respuestas:**
  - `200 OK`: Estadísticas de contratación nacional vs extranjera y estado de cumplimiento de la proporción legal del 90% (Art. 11 Código de Trabajo).

### 4. Obtener Empleado por ID
- **Ruta:** `GET /empleados/:id`
- **Permisos:** Cualquier usuario autenticado.
- **Respuestas:**
  - `200 OK`: Datos del empleado e indicación de alertas previsionales.
  - `404 Not Found`: No existe un empleado con el ID especificado.

### 5. Actualizar Empleado por ID
- **Ruta:** `PATCH /empleados/:id`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo de la Petición (DTO):** `UpdateEmpleadoDto` (campos opcionales, incluye `motivoCambioSalario` si se actualiza el sueldo).
- **Respuestas:**
  - `200 OK`: Datos actualizados del empleado.
  - `404 Not Found`: Empleado no encontrado.
  - `400 Bad Request`: Salario por debajo del mínimo del sector económico o formato de documento erróneo.
  - `409 Conflict`: El Documento de Identidad o Correo al que se intenta actualizar ya pertenece a otro usuario.

### 6. Obtener Historial de Cambios de Salario
- **Ruta:** `GET /empleados/:id/historial-salarios`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Respuestas:**
  - `200 OK`: Colección ordenada de forma descendente con el histórico de sueldos (salario anterior, nuevo, fecha y motivo).
  - `404 Not Found`: Empleado no encontrado.

### 7. Eliminar Empleado por ID
- **Ruta:** `DELETE /empleados/:id`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Respuestas:**
  - `200 OK`: Confirmación de eliminación del recurso.
  - `404 Not Found`: Empleado no encontrado.

---

## Decisiones de Negocio y Cumplimiento Legal

1. **Flexibilización de Identidad para Extranjeros:** 
   - El sistema clasifica el tipo de documento (`DUI`, `PASAPORTE`, `CARNET_RESIDENCIA`) mediante `tipoDocumento`.
   - Si el tipo es `DUI`, se valida con la máscara rígida `00000000-0` (8 dígitos, guion y dígito verificador). Si es `PASAPORTE` o `CARNET_RESIDENCIA`, se valida con formatos alfanuméricos flexibles para acomodar a no nacionales.

2. **Salarios Mínimos por Sector Económico (Decreto Ejecutivo N.º 11, MTPS):**
   - Cada empleado está ligado a un `sectorEconomico` (Comercio/Servicios/Industria, Maquila, Beneficios de Café/Azúcar, Agropecuario).
   - El sistema bloquea de manera obligatoria la creación o actualización de empleados si el salario base está por debajo del mínimo de ley correspondiente:
     - Comercio/Servicios/Industria: **$408.80**
     - Maquila Textil: **$402.32**
     - Beneficio de Café/Azúcar: **$305.23**
     - Agropecuario: **$272.53**

3. **Plazos de Documentación (AFP e ISSS):**
   - Para no entorpecer capacitaciones o inducciones de personal nuevo, el registro inicial permite guardar `afp` e `isss` vacíos.
   - Sin embargo, si transcurren **más de 7 días naturales** desde su `fechaIngreso` contractual sin registrar dichos documentos, el sistema activa la bandera virtual `alertaDocumentacionVencida: true` en el perfil del empleado para indicar omisión de trámites obligatorios.

4. **Historial de Salarios e Inmutabilidad:**
   - Para fines de auditoría del Ministerio de Trabajo, cualquier edición del salario base genera un registro de auditoría en la tabla `historial_salarios`. HR puede ingresar un campo explicativo `motivoCambioSalario` al guardar el cambio.

5. **Antigüedad y Días Trabajados:**
   - La fecha que rige el cálculo del tiempo de servicio y días laborados para la nómina es la `fechaIngreso` (establecida por contrato laboral), mientras que la columna automática `fechaRegistro` se almacena con fines de trazabilidad interna en base de datos.

---

## Dependencias con Otros Módulos

- **Consumidores:**
  - **Módulo de Autenticación (`auth`):** Consume `EmpleadosService` para buscar usuarios por su documento de identidad en el inicio de sesión (`findByDocumentoIdentidadWithPassword`) y para validar firmas JWT (`findOne`).
- **Proveedores de Datos para Otros Módulos:**
  - **Deducciones (Persona 2):** Necesitará consultar el `salarioBase` del empleado para efectuar cálculos de ISSS, AFP e ISR.
  - **Novedades (Persona 3):** Enlaza eventos diarios al `id` de empleado.
  - **Nómina (Persona 4):** Utiliza los salarios base activos y el historial de cambios de salario para prorrateos y cómputos.

---

## Pruebas Unitarias

Para ejecutar el conjunto de pruebas unitarias específicas del módulo de empleados, utiliza:
```bash
npm run test -- src/empleados
```
Para ver la cobertura de código:
```bash
npm run test:cov
```
