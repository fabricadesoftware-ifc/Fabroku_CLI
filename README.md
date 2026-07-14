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

### `fabroku db connect`

Abre uma sessao SQL auditada em um PostgreSQL ou PostGIS vinculado ao app.

```bash
fabroku db connect --app meu-app

# Necessario quando o app possui mais de um banco compativel
fabroku db connect --app meu-app --service mapas-db
```

A sessao usa `dokku postgres:connect` no servidor. PostGIS e tratado como um
banco PostgreSQL compativel; a extensao espacial ja e habilitada na criacao do
servico pelo Fabroku.

### `fabroku mcp`

Inicia um servidor [Model Context Protocol](https://modelcontextprotocol.io/)
local via `stdio`, permitindo que ferramentas de IA consultem e operem o
Fabroku usando a autenticação e as permissões já existentes na CLI.

Primeiro autentique a CLI normalmente:

```bash
fabroku login
```

Depois configure o cliente MCP para iniciar o processo:

```json
{
  "mcpServers": {
    "fabroku": {
      "command": "fabroku",
      "args": ["mcp"]
    }
  }
}
```

As ferramentas disponíveis permitem listar projetos, apps e serviços,
consultar status e logs, executar migrations Django e solicitar redeploy. Por
segurança, valores de variáveis de ambiente e outros segredos não são
retornados.

#### Fluxo de redeploy para IAs

O MCP não cria commits e não envia arquivos locais. Antes de chamar
`fabroku_redeploy`, a IA deve:

1. Alterar o código e revisar o diff.
2. Executar os testes apropriados.
3. Criar um commit com as alterações.
4. Executar `git push` para a branch configurada no app.
5. Chamar `fabroku_redeploy` confirmando `confirmed_committed_and_pushed=true`.

Isso é necessário porque o Fabroku faz redeploy do repositório remoto; código
sem commit ou sem `git push` não chega ao servidor.

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
