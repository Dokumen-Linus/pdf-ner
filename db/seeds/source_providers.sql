INSERT INTO public.source_providers ( id, provider, provider_type, vendor ) VALUES

( 'gdrive', 'Google Drive', 'content_collab', 'google' ),
( 'onedrive', 'OneDrive', 'content_collab', 'microsoft' ),
( 'gcs', 'Google Cloud Storage (GCS)', 'infra', 'google' ),
( 'az_blob', 'Azure Blob Storage', 'infra', 'microsoft' ),
( 'external_s3', 'AWS S3', 'infra', 'amazon' ),
( 'gmail', 'Gmail', 'email', 'google' ),
( 'outlook', 'Outlook', 'email', 'microsoft' )

ON CONFLICT (id) DO UPDATE SET
    provider = EXCLUDED.provider,
    provider_type = EXCLUDED.provider_type,
    vendor = EXCLUDED.vendor;
