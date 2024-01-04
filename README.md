# Boluo

A chat tool made for play RPG.

This repository is a monorepo, which contains the following applications:

- `apps/site`: The web site frontend.
- `apps/server`: The server.
- `apps/legacy`: The old version of Boluo web application.
- `apps/spa`: The single page application.

## Set Up Development Environment

We recommomend you to use [nix](https://nixos.org/) package manager ([installer](https://github.com/DeterminateSystems/nix-installer)), which is easiest way to set up development environment. After you install nix, just run `nix develop` to get a shell with all required tools.

But if you don't want to use nix, you can install the following tools manually:

- Rust toolchain: Even though you just want to develop the frontend, you still recommended to install Rust because code generation depends on it.
- Node.js
- [dprint](https://dprint.dev/): For formatting.
- Docker or Podman (recommanded)

We also provide the codespaces configuration, which can be used to develop in GitHub web interface or locally without set up anything.

### Development Services

If you want to develop the server, you need to start the development services first. Otherwise, you can just set up the `BACKEND_URL` environment variable to point to the production server.

Rename example configurations:

```bash
./scripts/rename-examples.sh
# Change ports if you need
# vim services/.docker-compose.override.yml
```

Then start development services use `docker-compose`:

```base
cd services
docker-compose up
```

### Check The Environment

```bash
# Server
cargo test
# Web
npm install
npm build
```
