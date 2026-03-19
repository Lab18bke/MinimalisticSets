# MinimalisticSets:
MinimalisticSets is a User Interface which allows McSets's SetEnterprise Users to easily make a page where clients can pay. Clients / Buyers put in an amount and they get redirected to McSet's Checkout Page where they pay and upon successful payment and a Success Message is sent via a Discord Webhook.

Simple, Minimalistic.

## How to set it up?
1. Download the Source Code.
2. Make a .env file at the Project Root. 
3. Populate the .env with: 
    MCSETS_API_KEY - your McSets SetEnterprise API Key. Starts with ent_test if Demo API Key or ent_live if Live API Key.
    STORE_NAME - the Name to be displayed on the Page.
    DISCORD_WEBHOOK_URL - the Webhook URL.
    PORT - the Port you want it to run at.
    BASE_URL - the URL your Users will visit it at.
4. The BASE_URL should be the Domain your users access it from. You can use either Nginx/Caddy to reverse-proxy localhost:PORT to the BASE_URL.

Enjoy!!

## Some Previews: 
<img width="1365" height="601" alt="image" src="https://github.com/user-attachments/assets/076edee6-ad27-48c9-a969-933994c71957" />
<img width="1365" height="601" alt="image" src="https://github.com/user-attachments/assets/7d5ac853-ae5b-4b7f-b930-759776bc11dd" />


