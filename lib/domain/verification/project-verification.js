export const FRONTEND_FILES = Object.freeze({
  ".buildpacks": {
    description: "Lista de buildpacks para deploy estático",
    content: "https://github.com/heroku/heroku-buildpack-nodejs\nhttps://github.com/dokku/buildpack-nginx\n",
  },
  ".static": {
    description: "Marcador para build estática",
    content: "",
  },
  "static.json": {
    description: "Configuração do servidor estático (rotas SPA)",
    content: `${JSON.stringify({
      root: "dist",
      clean_urls: true,
      routes: { "/**": "index.html" },
    }, null, 2)}\n`,
  },
});

export const BACKEND_FILES = Object.freeze({
  Procfile: {
    description: "Define o comando de execução do servidor",
    content: "web: gunicorn config.wsgi --bind 0.0.0.0:$PORT\n",
  },
  "requirements.txt": {
    description: "Dependências Python do projeto",
    content: null,
  },
  ".python-version": {
    description: "Versão do Python para deploy",
    content: "python-3.13.2\n",
  },
});

const BACKEND_MARKERS = ["manage.py", "requirements.txt", "setup.py", "pyproject.toml", "Pipfile"];

export function detectProjectType({ exists, read }) {
  if (exists("package.json")) {
    if (exists("Procfile")) {
      const content = read("Procfile");
      if (content.includes("node") || content.includes("npm")) return "backend";
    }
    return "frontend";
  }

  return BACKEND_MARKERS.some((marker) => exists(marker)) ? "backend" : null;
}

export function verifyRequiredFiles(type, { exists, write, fix = false }) {
  const requiredFiles = type === "frontend" ? FRONTEND_FILES : BACKEND_FILES;
  let missing = 0;
  let fixed = 0;
  const files = [];

  for (const [filename, info] of Object.entries(requiredFiles)) {
    const present = exists(filename);
    files.push({ filename, present, info });
    if (present) continue;

    missing += 1;
    if (fix && info.content !== null) {
      write(filename, info.content);
      fixed += 1;
    }
  }

  return { files, missing, fixed, remaining: missing - fixed };
}
