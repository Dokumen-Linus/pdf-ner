# Dokumen Infrastructure

## Providers

### Required Services

Key point: **Dokumen only uses 5 required providers**

Dokumen limits service providers and external APIs to reduce security risk and streamline compliance reports. Dokumen relies on 5 service providers: Stripe, Cloudflare, GitHub, AWS, and Runpod. Runpod provides accelerated AI/ML inference and training workloads. Runpod is an official OpenAI partner and received funding from Intel and Dell.

| Service                                                                         | Category                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------- |
| [Stripe](https://stripe.com)                                                    | Payments                                     |
| [Cloudflare Networking](https://www.cloudflare.com/products/)                   | DNS, SSL, DDoS, load balancing, rate limits  |
| [Cloudflare WAF](https://www.cloudflare.com/products/waf/)                      | Edge security firewall                       |
| [AWS VPC](https://aws.amazon.com/vpc/)                                          | Full-stack networking                        |
| [GitHub](https://github.com)                                                    | Source control                               |
| [GitHub Actions](https://github.com/features/actions)                           | CI/CD                                        |
| [AWS ECR](https://aws.amazon.com/ecr/)                                          | Container image registries                   |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)                  | Secrets management                           |
| [AWS EC2](https://aws.amazon.com/ec2/)                                          | CPU compute                                  |
| [Runpod.io](https://www.runpod.io)                                              | GPU compute                                  |
| [AWS RDS](https://aws.amazon.com/rds/)                                          | Managed database                             |
| [AWS ElastiCache](https://aws.amazon.com/elasticache/)                          | Managed cache                                |
| [AWS S3](https://aws.amazon.com/s3/)                                            | PDF storage                                  |
| [AWS SES](https://aws.amazon.com/ses/)                                          | Emails                                       |

### Optional Integrations

Clients can choose to use Dokumen's built-in integrations with 4 additional providers: Google, Microsoft, OpenAI, and Anthropic.

Authentication: Dokumen, Google, Microsoft
AI inference: Dokumen, OpenAI, Anthropic, Google Deepmind
PDF storage^: Dokumen, external AWS S3, Google Drive, GCS, Gmail, Microsoft OneDrive, Azure Blob, Outlook

^PDF storage integrations are not yet complete

**BYOK**: Dokumen supports Bring Your Own Key for AI inference. The web app does not yet allow users to upload keys, but you can contact us to provide keys in a separate secure method and use for your organization.

## Tech Stack

The Dokumen apps run on AWS EC2 and integrate the following tools and frameworks:

| Dependencies                                                                    | Category                                     |
| [Docker](https://docker.com) + [Compose](https://docs.docker.com/compose/)      | Container orchestration                      |
| [PostgreSQL](https://www.postgresql.org)                                        | Database                                     |
| [Redis](https://redis.io)                                                       | Cache                                        |
| [OpenTelemetry](https://opentelemetry.io)                                       | Observability                                |
| [TypeScript](https://www.typescriptlang.org)                                    | Frontend language                            |
| [Node.js](https://nodejs.org)                                                   | Frontend runtime                             |
| [Bun.js](https://bun.sh)                                                        | Frontend package manager                     |
| [Tanstack React Start](https://tanstack.com/start/v1)                           | Web app framework                            |
| [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/)                  | HTTPS reverse proxy                          |
| [PDFium](https://pdfium.googlesource.com/pdfium/)                               | PDF engine for frontend and backend          |
| [CPython](https://www.python.org)                                               | Backend language                             |
| [Uvicorn](https://www.uvicorn.org)                                              | Backend runtime and package manager          |
| [FastAPI](https://fastapi.tiangolo.com)                                         | API framework                                |
| [Celery](https://docs.celeryq.dev)                                              | Workers framework                            |
