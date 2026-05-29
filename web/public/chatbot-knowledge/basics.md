# The Problem

*Every business is modernizing big data processes, but what about information that isn't stored in a database or transfered in EDI format?*

Most unstructured, confidential information is sent as PDFs.

PDFs are read once and discarded. Or a human has to spend valuable time recording the PDF details.

Even tech-forward businesses rely on analysts to read PDFs and enter fields or trigger actions in their software systems.

# The Solution

*Dokumen AI automates PDF reading.*

Convert your PDFs into a dataset without our no-code interface for training and testing language models to extract key features.

From there, you can easily finalize an automation workflow to execute your business logic or mine insights on data you didn't realize you had.

Dokumen AI provides efficient, effective pre-built workflows plus customization and integration with your cloud and LLM providers.

# Methodology

## Centered on Security and Compliance with the Toughest PII, PHI, PCI Policies

The largest barrier to corporate adoption of automation workflows is not skill, cost, or accuracy - it is trust. Companies in regulated industries shouldn't allow developers to buy a API keys straight from OpenAI API. They shouldn't allow their vendors to either. Some companies make the mistake of being less strict on vendors' compliance. Many go to the other extreme, assuming no AI vendors are compliant (besides their cloud provider). Dokumen AI puts compliance first and technological capability second.

### Minimal Storage

The web app fetches PDFs individually from your cloud storage without ever storing a copy. The backend deletes saved documents and intermediate outputs when complete. Alternatively, the backend can be configured to write intermediate outputs to your cloud and never copy your documents. Unlike most startups, Dokumen AI does not use unproven serverless providers like Vercel, Supabase, and Neon, which are not HIPAA compliant. All data stays inside a virtual private cloud and the site is behind an Amazon-guaranteed firewall. Outputs are sent immediately to your SQL database, cloud CSV storage, or REST API. SQL recommended.

### Local-Only Option

Dokumen AI provides the option to host everything on our infrastructure. Zero CDNs or APIs outside our AWS Virtual Private Cloud (besides your cloud). Dokumen AI always uses in-house engines for PDF rendering and OCR. Locally-hosted language models are cost efficient and effective on moderately difficult use cases.

### On-Premise Deployment Option

The automation workflow can be deployed to your cloud or on-premise compute so that your PDF feature extraction is offloaded from Dokumen AI completely. This includes the ability to update the LLM model or provider, but it does not enable additional training. The web app for document labeling and output checking is designed as SaaS so it can't be downloaded. Local-Only can be combined with On-Premise Deployment to host Tesseract, olmOCR, GPT-OSS-120B, and SLMs entirely on your infrastructure.

## PDF To Text

Industry tools to identify text in images, a problem called Optical Character Recognition (OCR), have existed for a long time.

AI models drastically outperform traditional OCR engines on documents of unknown format. Nevertheless, most companies are using traditional OCR only.

Most AI workflows add cost and reduce accuracy by executing OCR on every PDF. Dokumen AI adapts to each PDF in a three-attempt approach.

1. Looks for text saved within the PDF file. Most PDFs printed from apps and websites already have text saved!
2. Applies Tesseract, the C++ OCR engine open sourced by Google that has become the gold standard in traditional OCR.
3. Applies olmOCR, an LLM open sourced by the Allen Institute for AI that is the current top performing OCR model.

## Text to Feature Table

Extracting key phrases from text, a problem called Named Entity Recognition (NER), was first solved with good accuracy by BERT, a model open sourced by Google in 2018. New small language models (SLMs) have improved upon BERT.

Large language models (LLMs), starting with GPT3 in 2022, are also able to solve NER with good accuracy and don't require training for each use case.

Dokumen AI provides developers a no-code interface to fine-tune and test SLMs and LLMs on each use case.

### Three options for running models:

#### Custom SLMs

• Locally hosted on our standard VM or one just for you

• Requires labelled training documents - we recommend at least 100 per use case

• Billed for training compute and model storage at cost - no markup!

• Straightforward $0.005/page in testing and production

#### Locally Hosted LLMs

• Use OpenAI open source models (GPT-OSS-120b) entirely on our AWS - no data transfers to external APIs!

• Describe your features and our AI will create many comprehensive prompts to test

• No training required, but improves with examples

• Straightforward $0.005/page in testing and production

#### Your LLM Provider

• Use your API key or endpoint for OpenAI or any provider

• Don't have any? Use our API keys for each client and OpenRouter provider requested

• $0.005/page with our API keys and default model

• Contact us for pricing with your keys or API wrappers

## Web App for Document Labeling & Output Checking

Dokumen AI enables analysts to easily create training documents and double check every production output before it is used.

In-browser PDF editing is more complicated than it seems. Many sites send documents to an external engine or CDN! We fork PDFium, the C++ WebAssembly engine for PDF rendering open sourced by Google. Our frontend is built with Next.js, React, and Typescript for a modern user experience. It is hosted on AWS Amplify, a Node.js server manager with proven compliance to HIPAA, EU GDPR, and other regulations.

# Ready to Automate Your Document Reading?

Join leading businesses already using Dokumen AI to automate their PDF workflows

Try the Demo
