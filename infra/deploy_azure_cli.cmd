@echo off
REM OpenBooks Azure Deploy (Windows CMD)
REM Prereqs:
REM  - Azure CLI installed: az --version
REM  - Logged in: az login

set RG=openbooks-rg
set LOC=uksouth

echo Creating resource group %RG% in %LOC% ...
az group create --name %RG% --location %LOC%

echo Deploying infrastructure with Bicep...
az deployment group create --resource-group %RG% --template-file main.bicep

echo.
echo Next steps (manual):
echo 1) Get outputs (app name, storage, cosmos):
echo    az deployment group show -g %RG% -n main --query properties.outputs
echo 2) Set App Settings that need secrets:
echo    - AZURE_STORAGE_CONNECTION_STRING
echo    - COSMOS_CONNECTION_STRING
echo 3) Zip deploy the /server folder to the Web App
echo    (see README_AZURE.md)
echo.
