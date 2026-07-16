# Módulo de Autenticación (Auth)

Este módulo gestiona la seguridad del sistema mediante JSON Web Tokens (JWT) y el control de acceso basado en roles (RBAC).

## Información General
- **Responsable:** Persona 1 (Susana Beltrán)
- **Directorio del Módulo:** `src/auth/`

---

## Endpoints Expuestos

### 1. Registrar Empleado
- **Ruta:** `POST /auth/register`
- **Cuerpo de la Petición (DTO):** [CreateEmpleadoDto](file:///c:/Users/susan/REPOSITORIES/Proyecto_Final_API_Nomina/src/empleados/dto/create-empleado.dto.ts)
- **Respuestas:**
  - `201 Created`: Devuelve el empleado registrado con contraseña omitida.
  - `400 Bad Request`: Datos de registro incorrectos o sin contraseña.
  - `409 Conflict`: El correo o DUI ya existe, o no se especificó contraseña en el registro.

### 2. Iniciar Sesión (Login)
- **Ruta:** `POST /auth/login`
- **Cuerpo de la Petición (DTO):** `LoginDto`
  ```json
  {
    "email": "susana@nomina.com",
    "password": "password123"
  }
  ```
- **Respuestas:**
  - `200 OK`: Autenticación exitosa. Devuelve el JWT firmado y la información esencial del usuario.
    ```json
    {
      "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
        "user": {
          "id": "e0b67bf5-4122-42c2-87db-2b6fe1d28362",
          "nombre": "Susana Beltrán",
          "email": "susana@nomina.com",
          "rol": "ADMIN"
        }
      }
    }
    ```
  - `401 Unauthorized`: Credenciales inválidas.

---

## Decisiones de Negocio y Seguridad

1. **Bootstrap de Seguridad (Primer Administrador):**
   - Para evitar que la base de datos comience sin ningún administrador (imposibilitando la creación de nuevos empleados por medio del CRUD protegido), el método `register` del servicio de autenticación verifica si la tabla de empleados está vacía.
   - Si no hay empleados registrados en el sistema, el primer usuario que se registre será forzado a tomar el rol de `ADMIN`, independientemente del rol enviado en la petición. Esto asegura un punto de entrada seguro para configurar la plataforma.
2. **Estrategia y Guardia JWT:**
   - La seguridad de las rutas se verifica extrayendo el token en la cabecera `Authorization: Bearer <token>` mediante [jwt.strategy.ts](file:///c:/Users/susan/REPOSITORIES/Proyecto_Final_API_Nomina/src/auth/strategies/jwt.strategy.ts).
   - Se inyecta la información recuperada en el objeto `req.user`.
3. **Control de Acceso basado en Roles (RBAC):**
   - El decorador `@Roles(EmpleadoRole...)` se utiliza en conjunto con el guardia de roles [roles.guard.ts](file:///c:/Users/susan/REPOSITORIES/Proyecto_Final_API_Nomina/src/auth/guards/roles.guard.ts) para autorizar endpoints.
   - Si el endpoint requiere roles específicos, el guardia compara los roles permitidos contra el rol del token de usuario inyectado en `req.user`. Si el rol no coincide, se deniega el acceso arrojando una excepción `ForbiddenException` (403).

---

## Dependencias con Otros Módulos

- **Módulo de Empleados (`empleados`):**
  - Este módulo depende fuertemente de `EmpleadosModule`. Utiliza `EmpleadosService` para insertar el nuevo empleado al registrarse, y para buscar la contraseña del usuario en el login, así como para validar al usuario a partir del ID en el JWT (`JwtStrategy.validate`).

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
