export function registerCommands(program, handlers) {
  program.command("login").description("Autenticar na plataforma Fabroku via GitHub").option("--api-url <url>", "URL base da API Fabroku").action((options) => handlers.login({ apiUrl: options.apiUrl }));
  program.command("logout").description("Encerrar a sessão da CLI").action(() => handlers.logout());
  program.command("verify").description("Verificar se o projeto tem os arquivos necessários para deploy").option("-d, --dir <path>", "Diretório do projeto", ".").option("-t, --type <type>", "Tipo da aplicação (frontend ou backend)").option("--fix", "Gerar arquivos faltantes automaticamente").action((options) => {
    const code = handlers.verify(options);
    if (code) process.exit(code);
  });
  program.command("apps").description("Listar seus apps na plataforma Fabroku").option("-p, --project <id>", "Filtrar por ID do projeto").action((options) => handlers.apps(options));
  program.command("deploy").description("Disparar deploy/redeploy de um app").option("-a, --app <name>", "Nome ou ID do app (senão detecta pelo git remote)").option("-d, --dir <path>", "Diretório do projeto", ".").option("--skip-verify", "Pular verificação de arquivos").option("--no-wait", "Não aguardar o deploy terminar").action((options) => handlers.deploy(options));
  program.command("whoami").description("Verificar o usuário autenticado").action(() => handlers.whoami());
  program.command("webhook [appId]").description("Diagnosticar e configurar webhook do GitHub para um app").option("--setup", "Criar/recriar o webhook automaticamente").option("--test", "Testar se commit status funciona (cria e remove um status)").action((appId, options) => handlers.webhook(appId, options));

  const run = program.command("run").description("Executar rotinas dentro de um app Fabroku");
  run.command("loaddata").description("Executar Django loaddata com um fixture ja presente no app").argument("<fixture>", "Caminho relativo do fixture JSON dentro do app").option("--django", "Executar usando Django").option("-a, --app <name>", "Nome ou ID do app (senao detecta pelo git remote)").option("-d, --dir <path>", "Diretorio local usado para detectar o app", ".").option("--manage <path>", "Caminho relativo do manage.py dentro do app", "manage.py").action((fixture, options) => handlers.runLoaddata(fixture, options));
  run.command("migrate").description("Executar Django migrate no app").option("-a, --app <name>", "Nome ou ID do app (senao detecta pelo git remote)").option("-d, --dir <path>", "Diretorio local usado para detectar o app", ".").option("--manage <path>", "Caminho relativo do manage.py dentro do app", "manage.py").option("--noinput", "Adicionar --noinput ao comando Django migrate").action((options) => handlers.runMigrate(options));
  run.command("dumpdata").description("Executar Django dumpdata no app e baixar o JSON gerado").allowUnknownOption(true).argument("[dumpArgs...]", "Argumentos repassados ao Django apos --").option("--django", "Executar usando Django").requiredOption("-o, --output <path>", "Arquivo JSON local de destino").option("-a, --app <name>", "Nome ou ID do app (senao detecta pelo git remote)").option("-d, --dir <path>", "Diretorio local usado para detectar o app", ".").option("--manage <path>", "Caminho relativo do manage.py dentro do app", "manage.py").action((dumpArgs, options) => handlers.runDumpdata(options, dumpArgs));
  run.command("createsuperuser").description("Abrir uma sessao interativa de Django createsuperuser no app").option("-a, --app <name>", "Nome ou ID do app (senao detecta pelo git remote)").option("-d, --dir <path>", "Diretorio local usado para detectar o app", ".").option("--manage <path>", "Caminho relativo do manage.py dentro do app", "manage.py").action((options) => handlers.runCreatesuperuser(options));

  const db = program.command("db").description("Conectar e operar bancos vinculados a apps Fabroku");
  db.command("connect").description("Abrir uma sessao auditada em um PostgreSQL ou PostGIS vinculado ao app").option("-a, --app <name>", "Nome ou ID do app (senao detecta pelo git remote)").option("-d, --dir <path>", "Diretorio local usado para detectar o app", ".").option("-s, --service <name>", "Nome ou ID do banco quando houver mais de um").action((options) => handlers.dbConnect(options));
  program.command("mcp").description("Iniciar o servidor MCP local do Fabroku via stdio").action(() => handlers.startMcpServer());
  return program;
}
