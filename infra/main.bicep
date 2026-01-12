param location string = resourceGroup().location
param appName string = 'openbooks-app-${uniqueString(resourceGroup().id)}'
param storageName string = toLower('obmedia${uniqueString(resourceGroup().id)}')
param cosmosName string = 'openbooks-cosmos-${uniqueString(resourceGroup().id)}'
param containerName string = 'openbooks-media'

@description('SKU for App Service Plan')
param planSku string = 'B1'

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: containerName
  properties: { publicAccess: 'Blob' }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      { locationName: location, failoverPriority: 0 }
    ]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    capabilities: [
      { name: 'EnableServerless' }
    ]
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'openbooksdb'
  properties: { resource: { id: 'openbooksdb' } }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'openbooks'
  properties: {
    resource: {
      id: 'openbooks'
      partitionKey: { paths: ['/type'], kind: 'Hash' }
    }
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: { name: planSku }
  properties: { reserved: true } // Linux
}

resource web 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        { name: 'PORT', value: '3000' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'STORAGE_PROVIDER', value: 'azureblob' }
        { name: 'DB_PROVIDER', value: 'cosmos' }
        { name: 'AZURE_BLOB_CONTAINER', value: containerName }
        { name: 'COSMOS_DB_NAME', value: 'openbooksdb' }
        { name: 'COSMOS_CONTAINER', value: 'openbooks' }
      ]
    }
    httpsOnly: true
  }
}

output appName string = web.name
output storageName string = storage.name
output cosmosName string = cosmos.name
