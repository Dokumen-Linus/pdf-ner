# Dokumen Infrastructure

## Providers

### Required Services

Key point: **Dokumen only uses 5 required providers**

Dokumen limits service providers and external APIs to reduce security risk and streamline compliance reports. Dokumen relies on 5 service providers: Stripe, Cloudflare, GitHub, AWS, and Runpod. Runpod provides accelerated AI/ML inference and training workloads. Runpod is an official OpenAI partner and received funding from Intel and Dell.

| Service                                                                         | Category                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------- |
| [Stripe](https://stripe.com)                                                    | Payments                                     |
| [Cloudflare WAF](https://www.cloudflare.com/application-services/products/waf/) | Edge security firewall                       |
| [GitHub](https://github.com)                                                    | Source control                               |
| [GitHub Actions](https://github.com/features/actions)                           | CI/CD automation                             |
| [Amazon ECR](https://aws.amazon.com/ecr/)                                       | Container registry                           |
| [Amazon EC2](https://aws.amazon.com/ec2/)                                       | CPU compute                                  |
| [Runpod.io](https://www.runpod.io)                                              | GPU compute                                  |
| [Amazon RDS](https://aws.amazon.com/rds/)                                       | Managed database                             |
| [Amazon ElastiCache](https://aws.amazon.com/elasticache/)                       | Managed cache                                |
| [Amazon S3](https://aws.amazon.com/s3/)                                         | PDF storage                                  |
| [Amazon SES](https://aws.amazon.com/ses/)                                       | Emails                                       |
| [Amazon VPC](https://aws.amazon.com/vpc/)                                       | Networking                                   |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)                  | Secrets management                           |

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
| [Nginx Proxy Manager](https://nginxproxymanager.com)                            | Reverse proxy & TLS termination              |
| [PostgreSQL](https://www.postgresql.org)                                        | Database                                     |
| [Redis](https://redis.io)                                                       | Cache                                        |
| [OpenTelemetry](https://opentelemetry.io)                                       | Observability                                |
| [TypeScript](https://www.typescriptlang.org)                                    | Frontend language                            |
| [Node.js](https://nodejs.org)                                                   | Frontend runtime                             |
| [Bun.js](https://bun.sh)                                                        | Frontend package manager                     |
| [Tanstack React Start](https://tanstack.com/start/v1)                           | Web app framework                            |
| [PDFium](https://pdfium.googlesource.com/pdfium/)                               | PDF engine for frontend and backend          |
| [Python](https://www.python.org)                                                | Backend language                             |
| [Uvicorn](https://www.uvicorn.org)                                              | Backend runtime and package manager          |
| [FastAPI](https://fastapi.tiangolo.com)                                         | API framework                                |
| [Celery](https://docs.celeryq.dev)                                              | Workers framework                            |
