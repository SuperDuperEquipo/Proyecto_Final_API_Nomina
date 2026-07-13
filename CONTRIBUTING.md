# API de Gestión de Nómina

## Para contribuir al repositorio

Para mantener la consistencia en el desarrollo, todo el equipo debe apegarse a:

1. **Formato de Respuesta Exitosa:** Todas las respuestas exitosas de los endpoints (GET, POST, PATCH, DELETE) deben envolver el objeto de respuesta dentro de un atributo data.
   Ejemplo:

   ```json
   {
     "data": {
       "id": 1,
       "nombre": "Juan Pérez",
       "cargo": "Desarrollador"
     }
   }
   ```

2. Definición de Terminado (Definition of Done - DoD)
   Una funcionalidad o módulo solo se considerará como "terminado" y listo para fusionarse a la rama main cuando cumpla todos estos requisitos:

- Código: Cumple con el linter y usa class-validator en los DTOs.

- Pruebas: Se implementaron pruebas y pasan exitosamente con Jest.

- Documentación: El endpoint está documentado en Swagger mediante decoradores.

- Revisión: El Pull Request (PR) cuenta con al menos la aprobación de un compañero de equipo.
