# Gard Security - Workspace

## Overview

pnpm workspace monorepo using TypeScript. Platform de operaciones de seguridad para guardias (Gard Security).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Maps**: Leaflet (OpenStreetMap)
- **Routing**: Wouter
- **State**: TanStack React Query

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

- **gard-security** (web, preview: `/`) — Frontend React app
- **api-server** (api, preview: `/api`) — Express REST API

## Features Implemented

### Authentication
- Login con RUT y código de acceso
- Roles: `admin`, `supervisor`, `guard`
- JWT simple (base64) en localStorage

### Guard Features
- Dashboard personalizado
- Los guardias solo ven indicadores operativos propios; métricas de cantidad de guardias quedan reservadas para jefe/supervisor
- Fecha del día visible en el panel principal
- Rondas asignadas con mapa interactivo
- Cronómetro visible para rondas en curso, tanto para guardias como para jefes/supervisores
- Cada ronda registra y muestra la empresa/cliente donde se realiza el servicio
- **GPS automático**: transmite ubicación cada 15 segundos al servidor
- **Detección automática de checkpoints**: al estar dentro del radio GPS del punto, se registra solo
- Los puntos de control solo pueden marcarse a máximo 10 metros del punto GPS
- Botón de pánico directo con GPS, última ubicación conocida y fallback si el GPS no responde
- Modo Guardia móvil en `/guard-mode`: ronda activa/proxima, inicio/cierre de ronda, pánico grande, reporte rápido de incidentes y estado operativo
- Reporte de incidentes
- Chat interno
- Interfaz móvil revisada para chat, incidentes, alertas, rondas, equipo y perfil, evitando desbordes laterales en pantallas estrechas

### Admin/Supervisor Features
- Centro de comando con estadísticas
- Alertas operativas visibles para supervisores/admin ante pánico activo o incidentes de alta prioridad
- Dashboard táctico con pánico activo, incidentes prioritarios, guardias en ronda y guardias sin señal GPS
- Reportes operativos en `/reports` para supervisores/admin: KPIs por periodo, rendimiento por empresa/cliente, bitácora combinada y exportación CSV
- Mapa en vivo con posición de guardias (polling 5s)
  - Guardias en verde = En Linea, azul = En Ronda
  - Lista de rondas activas con barra de progreso
- Creación de rondas reutilizables con puntos GPS en mapa (click para colocar); una misma ronda puede iniciarse nuevamente otro día y reinicia sus puntos
- Gestión de incidentes
- Filtros de incidentes por estado y prioridad, con confirmación antes de cerrar/resolver
- Gestión de usuarios (CRUD)
- Monitoreo de alertas de pánico
- Confirmación antes de resolver alertas de pánico activas

### Backend
- `POST /api/location/update` — guarda GPS y auto-detecta si el guardia está en ronda activa
- `GET /api/location/guards` — devuelve posiciones de todos los guardias
- Validación por distancia Haversine para check-in de checkpoints

## Production Data Policy

- La aplicación no carga usuarios, rondas, empresas ni incidentes de prueba.
- Cuando la base de datos está vacía, la pantalla inicial permite crear el primer administrador real.
- Los códigos de acceso se guardan con hash PBKDF2; no se guardan como texto simple para usuarios nuevos.
- Las rutas operativas requieren autenticación y las acciones administrativas quedan limitadas a supervisores/administradores según corresponda.

## Architecture Notes

- OpenAPI spec lives in `lib/api-spec/openapi.yaml`
- Generated client hooks in `lib/api-client-react/`
- Generated Zod schemas in `lib/api-zod/`
- DB schema in `lib/db/src/schema/`
- After changing OpenAPI spec: run codegen, then restart api-server

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
