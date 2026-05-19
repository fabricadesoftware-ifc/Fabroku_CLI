# 🚀 Fabroku CLI

Ferramenta de linha de comando para o [Fabroku PaaS](https://github.com/fabricadesoftware-ifc/Fabroku) — verifica arquivos de deploy, autentica via GitHub e gerencia apps.

## Instalação

```bash
npm i -g fabroku
```

> Requer Node.js 18+

## Comandos

### `fabroku verify`

Verifica se o projeto tem os arquivos necessários para deploy no Dokku.

```bash
# No diretório do projeto
fabroku verify

# Especificando diretório
fabroku verify --dir ./meu-projeto

# Forçar tipo (frontend ou backend)
fabroku verify --type backend

# Gerar arquivos faltantes
fabroku verify --fix
```

**Frontend** (Vue, React, etc.) precisa de:
- `.buildpacks`
- `.static`
- `static.json`

**Backend** (Django, Flask, etc.) precisa de:
- `Procfile`
- `requirements.txt`
- `runtime.txt`

### `fabroku login`

Autenticação via GitHub OAuth — abre o navegador automaticamente.

```bash
fabroku login

# Apontar para API de produção
fabroku login --api-url https://api.fabroku.ifc.edu.br
```

### `fabroku logout`

Encerrar sessão.

```bash
fabroku logout
```

### `fabroku whoami`

Verificar usuário autenticado e status do token.

```bash
fabroku whoami
```

### `fabroku apps`

Listar seus apps.

```bash
fabroku apps

# Filtrar por projeto
fabroku apps --project 42
```

## Configuração

A CLI salva as credenciais em `~/.fabroku/config.json`:

```json
{
  "api_url": "http://localhost:8000",
  "token": "...",
  "user": "seu-usuario"
}
```

## Desenvolvimento

```bash
cd Fabroku_CLI
npm install
npm link        # Instala globalmente em mode dev
fabroku --help  # Testa
```
