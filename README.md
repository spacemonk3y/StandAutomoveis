# StandAutomoveis (Piloto)

Site piloto de stand de automóveis usados com frontend Angular e backend FastAPI.

## Arquitetura
- Frontend: Angular (SSR dev), Angular Material, LESS. Pasta `frontend/`.
- Backend: FastAPI + SQLAlchemy + PostgreSQL. Pasta `backend/`.
- Scraper/inputs: `puppeteer/` (JSONs de exemplo para import).
- Docker Compose: serviços `stand-frontend`, `stand-backend`, `db`, `puppeteer`.

## Como correr
- Requisitos: Docker + Docker Compose.
- Arranque: `docker compose up --build`
- Frontend dev: http://localhost:4200 (proxy para backend via `/api`).
- API: http://localhost:8000 (Swagger: http://localhost:8000/docs).

## Decisões e flags
- Modo piloto (só leitura) ATIVO por defeito.
  - Backend bloqueia escrita (create/bulk/import/update) com 403 se `READ_ONLY_MODE` não for `0`.
  - Frontend tem rotas de gestão/criação/edição comentadas.
- Homepage: lista até 12 carros; botão “Mais filtros” expande opções.
- Logo transparente em `frontend/public/logo_car.png`; em modo escuro é invertido por CSS.

## Ativar modo edição (temporário)
- Backend (permitir escrita): definir `READ_ONLY_MODE=0` no serviço `stand-backend` (docker-compose ou env local) e reiniciar.
- Frontend (rotas de gestão): descomentar imports/rotas em `frontend/src/app/app.routes.ts` para expor:
  - `/cars/manage`, `/cars/create`, `/cars/bulk`, `/cars/:id/edit`.

## Modelo de dados (resumo)
Entidade `Car` (principais): `id`, `url`, `title`, `make`, `model`, `version`, `color`, `doors`, `seats`, `engine_capacity_cc`, `engine_power_cv`, `fuel_type`, `body_type`, `gearbox`, `mileage_km`, `registration_month`, `registration_year`, `price`, `currency`, `images`, `fields_pt`.

## Import/normalização
- `POST /cars/import` aceita ficheiro JSON com lista/objeto de viaturas.
- Normaliza números (km, cv, cm3, preço) e aceita chaves EN/PT.

## Próximos passos
- Autenticação simples (SSO básico) e RBAC para gestão.
- HTTPS (reverse proxy e certificados – Caddy/Traefik/NGINX).
- Testes automáticos: backend (pytest), frontend (Cypress/Playwright), smoke e2e.
- Observabilidade: logs estruturados, métricas, healthchecks.
- CI: lint + testes + build/push imagens.

