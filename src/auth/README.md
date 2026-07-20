# Módulo de Autenticación (Auth)

Este módulo gestiona la seguridad del sistema mediante JSON Web Tokens (JWT) y el control de acceso basado en roles (RBAC).

## Información General
- **Responsable:** Susana Beltrán
- **Directorio del Módulo:** `src/auth/`

---

## Endpoints Expuestos

### 1. Registrar Empleado
- **Ruta:** `POST /auth/register`
- **Cuerpo de la Petición (DTO):** `CreateEmpleadoDto`
- **Respuestas:**
  - `201 Created`: Devuelve el empleado registrado con contraseña omitida.
  - `400 Bad Request`: Datos de registro incorrectos o sin contraseña.
  - `409 Conflict`: El correo o DUI ya existe, o no se especificó contraseña en el registro.

### 2. Iniciar Sesión (Login)
- **Ruta:** `POST /auth/login`
- **Cuerpo de la Petición (DTO):** `LoginDto`
  ```json
  {
    "documentoIdentidad": "00000000-0",
    "password": "adminPassword123"
  }
  ```
- **Respuestas:**
  - `200 OK`: Autenticación exitosa. Devuelve el JWT firmado y la información esencial del usuario.
    ```json
    {
      "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
        "user": {
          "id": 1,
          "nombre": "Administrador del Sistema",
          "email": "admin@nomina.com",
          "rol": "ADMIN"
        }
      }
    }
    ```
  - `401 Unauthorized`: Credenciales inválidas.

---

## Decisiones de Negocio y Seguridad

1. **Semilla de Administrador (Seed Admin):**
   - Al iniciar la aplicación, el gancho de ciclo de vida `OnApplicationBootstrap` en `EmpleadosService` verifica si la base de datos está vacía.
   - Si no hay empleados registrados, se crea automáticamente un usuario administrador semilla con las siguientes credenciales para poder iniciar sesión inmediatamente:
     - **Documento de Identidad (DUI):** `00000000-0`
     - **Contraseña:** `adminPassword123`
     - **Correo Electrónico:** `admin@nomina.com`
     - **Rol:** `ADMIN`
2. **Bootstrap de Seguridad (Primer Registro Manual):**
   - Si la base de datos estuviera vacía (ej. si se borrara la semilla) y se realiza un registro manual mediante `POST /auth/register`, el sistema forzará a que ese primer usuario registrado tome el rol de `ADMIN`, independientemente del rol solicitado en el cuerpo de la petición. Esto asegura un punto de entrada seguro para configurar la plataforma.
2. **Estrategia y Guardia JWT:**
   - La seguridad de las rutas se verifica extrayendo el token en la cabecera `Authorization: Bearer <token>` mediante `jwt.strategy.ts`.
   - Se inyecta la información recuperada en el objeto `req.user`.
3. **Control de Acceso basado en Roles (RBAC):**
   - El decorador `@Roles(...)` se utiliza en conjunto con el guardia de roles `roles.guard.ts` para autorizar endpoints.
   - Si el endpoint requiere roles específicos, el guardia compara los roles permitidos contra el rol del token de usuario inyectado en `req.user`. Si el rol no coincide, se deniega el acceso arrojando una excepción `ForbiddenException` (403).

---

## Dependencias con Otros Módulos

- **Módulo de Empleados (`empleados`):**
  - Este módulo depende de `EmpleadosModule`. Utiliza `EmpleadosService` para insertar el nuevo empleado al registrarse, para buscar la contraseña del usuario en el login, y para validar al usuario a partir del ID en el JWT (`JwtStrategy.validate`).

---

## Pruebas Unitarias

Para ejecutar el conjunto de pruebas unitarias específicas del módulo de autenticación:
```bash
npm run test -- src/auth
```
Para ver la cobertura del módulo:
```bash
npm run test:cov
```
