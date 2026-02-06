# Dokumen AI Monorepo

## Database

The [PostgreSQL](https://www.postgresql.org/) database is defined by SQL scripts. Migrations are performed by [dbmate](https://github.com/amacneil/dbmate). The database server needs to be started before running code that depends on it. The database will be saved locally in .\pgdata. To start, run this script in a separate, dedicated terminal:

```cmd
pg_ctl -D .\pgdata -l logfile start
```

## Containerization

- [Docker](https://www.docker.com/)

## Quickstart

1 Install [Git](https://git-scm.com/downloads) and [Microsoft VS Code](https://code.visualstudio.com/download) or fork
2 Clone repo:

```cmd
git clone https://github.com/optimalcharb/pdf-entity-labeling.git
```

3 Install recommended extensions

## Version Control

- DevOps CI/CD: [GitHub Actions](https://github.com/features/actions)
- [Conventional Commits](https://www.conventionalcommits.org/) enforced by [husky](https://github.com/typicode/husky) config by .commitlintrc.json, commit messages must start with a prefix in the table below, the workflow edits CHANGELOG.md on any version bump

| commit prefix | version bump           | definition                                 |
| ------------- | ---------------------- | ------------------------------------------ |
| type!:        | major (0.0.0 -> 1.0.0) | breaking changes (`feat!:`, `perf!:`, ...) |
| feat:         | minor (0.0.0 -> 0.1.0) | new feature                                |
| perf:         | patch (0.0.0 -> 0.0.1) | performance improvement                    |
| fix:          | patch (0.0.0 -> 0.0.1) | bug fix                                    |
| docs:         | none                   | documentation changes                      |
| test:         | none                   | adding or updating tests                   |
| ci:           | none                   | CI/CD configuration changes                |
| revert:       | none                   | reverting previous commits                 |
| style:        | none                   | formatting without code changes            |
| refactor:     | none                   | reorganizing code without changes          |
| chore:        | none                   | maintenance tasks                          |
| build:        | none                   | build system or dependencies               |
