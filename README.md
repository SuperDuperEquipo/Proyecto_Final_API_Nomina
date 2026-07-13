# API de Gestión de Nómina

Proyecto de diseño y desarrollo de una API RESTful para la gestión de nómina, implementada con una arquitectura modular.

## Stack Tecnológico

El proyecto está construido sobre las siguientes tecnologías[cite: 1]:

- **Framework:** NestJS (Node.js + TypeScript).
- **Base de Datos:** PostgreSQL.
- **ORM:** TypeORM.
- **Validación:** `class-validator` y `class-transformer`.
- **Autenticación:** `@nestjs/passport` y `passport-jwt`.
- **Documentación:** `@nestjs/swagger`.
- **Pruebas:** Jest + Supertest.
- **Entorno Local:** Docker Compose.

## Cómo levantar el entorno local

Sigue estos pasos para ejecutar el proyecto en tu máquina:

1. **Variables de entorno:** Copia el archivo de ejemplo y renómbralo. Luego, coloca tus credenciales locales (como tu clave secreta de JWT).
   ```bash
   cp .env.example .env

   ```
2. Levantar la base de datos: Inicia el contenedor de PostgreSQL usando Docker.
   ```bash
   docker compose up -d

   ```
3. Instalar dependencias:
   ```bash
   npm install

   ```
4. Ejecutar el proyecto:
   ```bash
   npm run start:dev
   ```

## Estructura de Carpetas

El proyecto sigue una convención modular dentro de NestJS. Cada funcionalidad principal tiene su propio módulo independiente con sus respectivos Controladores, Servicios, DTOs y Entidades:

- auth/ - Autenticación y roles.

- empleados/ - Gestión del personal.

- deducciones/ - Configuraciones de ley (ISSS, AFP, ISR).

- novedades/ - Horas extra, permisos, etc.

- nomina/ - Ciclo de vida de la planilla.

- comprobantes/ - Generación de recibos.

## Documentación de la API (Swagger)

Una vez levantado el servidor, puedes acceder a la documentación interactiva autogenerada ingresando a:

```bash
http://localhost:3000/api/docs
```

Cada desarrollador debe documentar endpoints, parámetros y respuestas utilizando los decoradores de @nestjs/swagger directamente en el código

## Fuentes Legales Citadas (El Salvador)

Los cálculos de este sistema se basan en la legislación vigente:

• Ministerio de Hacienda — Decreto Ejecutivo No. 10, tablas de retención de ISR: https://www.mh.gob.sv/modificacion-a-las-tablas-de-retencion-del-impuesto-sobre-la-renta-decreto-ejecutivo-no-10/

• Instituto Salvadoreño del Seguro Social — Art. 29 Ley del Seguro Social (cotización ISSS): https://www.isss.gob.sv/

• Superintendencia del Sistema Financiero — regulador de las AFP, Ley Integral del Sistema de Pensiones (cotización AFP): https://www.ssf.gob.sv/
