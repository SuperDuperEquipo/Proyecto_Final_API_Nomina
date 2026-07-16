# Módulo de Empleados

Este módulo se encarga de la gestión y administración del personal dentro del sistema de nómina.

## Información General
- **Responsable:** Persona 1 (Susana Beltrán)
- **Directorio del Módulo:** `src/empleados/`

---

## Endpoints Expuestos

Todos los endpoints (excepto las excepciones de roles) están protegidos mediante el guardia de autenticación JWT y de roles. Requieren una cabecera `Authorization: Bearer <JWT_TOKEN>`.

### 1. Crear Empleado
- **Ruta:** `POST /empleados`
- **Permisos:** Solo usuarios con rol `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo de la Petición (DTO):** [CreateEmpleadoDto](file:///c:/Users/susan/REPOSITORIES/Proyecto_Final_API_Nomina/src/empleados/dto/create-empleado.dto.ts)
  ```json
  {
    "nombre": "Juan Pérez",
    "dui": "00000001-2",
    "email": "juan.perez@nomina.com",
    "password": "juanito123",
    "salarioBase": 850.00,
    "cargo": "Auxiliar Contable",
    "area": "Finanzas",
    "fechaIngreso": "2026-07-15",
    "afp": "AFP Confía",
    "rol": "EMPLEADO"
  }
  ```
- **Respuestas:**
  - `201 Created`: Devuelve el empleado creado con el ID generado (UUID) y omitiendo el campo de contraseña por seguridad.
  - `400 Bad Request`: Datos de entrada inválidos o faltantes.
  - `409 Conflict`: El DUI o el Correo ya existen en la base de datos.

### 2. Obtener Todos los Empleados
- **Ruta:** `GET /empleados`
- **Permisos:** Cualquier usuario autenticado (`ADMIN`, `RECURSOS_HUMANOS`, `EMPLEADO`).
- **Respuestas:**
  - `200 OK`: Lista de empleados registrados (con las contraseñas omitidas).

### 3. Obtener Empleado por ID
- **Ruta:** `GET /empleados/:id`
- **Permisos:** Cualquier usuario autenticado.
- **Respuestas:**
  - `200 OK`: Datos del empleado encontrado.
  - `404 Not Found`: No existe un empleado con el ID especificado.

### 4. Actualizar Empleado por ID
- **Ruta:** `PATCH /empleados/:id`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Cuerpo de la Petición (DTO):** [UpdateEmpleadoDto](file:///c:/Users/susan/REPOSITORIES/Proyecto_Final_API_Nomina/src/empleados/dto/update-empleado.dto.ts) (campos opcionales).
- **Respuestas:**
  - `200 OK`: Datos actualizados del empleado.
  - `404 Not Found`: Empleado no encontrado.
  - `409 Conflict`: El DUI o Correo al que se intenta actualizar ya pertenece a otro usuario.

### 5. Eliminar Empleado por ID
- **Ruta:** `DELETE /empleados/:id`
- **Permisos:** Solo `ADMIN` o `RECURSOS_HUMANOS`.
- **Respuestas:**
  - `200 OK`: Confirmación de eliminación del recurso.
  - `404 Not Found`: Empleado no encontrado.

---

## Decisiones de Negocio y Casos Borde

1. **Uso de UUID para Identificadores:** Se optó por usar identificadores de tipo `UUID` (`@PrimaryGeneratedColumn('uuid')`) para asegurar que no se expongan correlativos en las URLs públicas y para facilitar futuras sincronizaciones distribuidas.
2. **Formato estricto de DUI (El Salvador):** Mediante la validación de `class-validator` `@Length(10, 10)`, obligamos a que el DUI cumpla el estándar nacional de 8 dígitos, un guion y un dígito verificador (ej. `01234567-8`).
3. **Seguridad y Encriptación:** Las contraseñas de los usuarios se almacenan utilizando `bcryptjs` con un factor de costo (salt rounds) de 10. Por seguridad, todos los métodos que retornan información del empleado (tanto individuales como listados) omiten explícitamente la contraseña mediante manipulación del objeto de respuesta o exclusión selectiva en base de datos.

---

## Dependencias con Otros Módulos

- **Consumidores:**
  - **Módulo de Autenticación (`auth`):** Consume `EmpleadosService` para buscar usuarios por correo en la fase de inicio de sesión (`findByEmailWithPassword`) y para validar la firma de los tokens JWT (`findOne`).
- **Proveedores de Datos para Otros Módulos:**
  - **Deducciones (Persona 2):** Necesitará consultar el `salarioBase` del empleado para efectuar cálculos de ISSS, AFP e ISR.
  - **Novedades (Persona 3):** Necesitará enlazar cada novedad (horas extra, permisos) con el `id` del empleado.
  - **Nómina (Persona 4):** Necesitará la lista activa de empleados para calcular los pagos mensuales.
  - **Comprobantes (Persona 5):** Necesitará la información del empleado para generar los recibos de pago.

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
