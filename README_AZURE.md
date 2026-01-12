# OpenBooks on Azure (Cloud-Native Path)

This project already runs locally as:
- Static UI (served by Express)
- REST API (Express)
- Persistence: JSON file DB
- Storage: local disk uploads

To meet the cloud-native requirements, use these Azure services:

## Recommended Azure Architecture
- **Frontend static hosting**: Azure Static Web Apps *(or Blob Static Website)*  
- **REST API**: Azure App Service (Node.js) *(or Azure Functions)*  
- **Object storage**: Azure Blob Storage (public blob container for demo)  
- **Database**: Azure Cosmos DB (serverless)  
- **Caching**: Azure CDN + Azure Cache for Redis *(future step)*  
- **DNS routing**: Azure Front Door / Traffic Manager *(future step)*

This repo includes optional code paths:
- `STORAGE_PROVIDER=azureblob` uploads images to Blob Storage
- `DB_PROVIDER=cosmos` stores metadata/interactions in Cosmos DB

## 1) Deploy infra (Bicep)
From `infra/`:
```cmd
deploy_azure_cli.cmd
```

## 2) Configure secrets (App Settings)
In Azure Portal → Web App → Configuration → Application settings, add:

- `AZURE_STORAGE_CONNECTION_STRING` = (from Storage Account → Access keys)
- `COSMOS_CONNECTION_STRING` = (from Cosmos DB → Connection strings)

The template already sets:
- `STORAGE_PROVIDER=azureblob`
- `DB_PROVIDER=cosmos`
- `AZURE_BLOB_CONTAINER=openbooks-media`

## 3) Zip-deploy the Node server to App Service
From the project root:
```cmd
cd server
npm install
npm run start
```

For Azure zip deploy (recommended):
```cmd
cd server
npm install
npm prune --production
cd ..
powershell -Command "Compress-Archive -Path server\* -DestinationPath server_package.zip -Force"
az webapp deploy --resource-group openbooks-rg --name <APP_NAME> --src-path server_package.zip --type zip
```

Then open:
- `https://<APP_NAME>.azurewebsites.net/`

## Notes for coursework writeup
- REST calls: `/api/posts`, `/api/posts/:id/comments`, `/api/posts/:id/rate`, `/api/posts/:id/like`
- Blob Storage: media objects stored in container and referenced by URL
- Cosmos DB: entities partitioned by `/type` for quick queries
- Security: for coursework demo, blob is public. For production, use SAS tokens + auth.
