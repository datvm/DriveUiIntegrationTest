App is deployed on GitHub Pages: [https://datvm.github.io/DriveUiIntegrationTest/](https://datvm.github.io/DriveUiIntegrationTest/)

A simple page for testing [Google Drive UI integration](https://developers.google.com/drive/api/guides/about-apps): [Open With](https://developers.google.com/drive/api/guides/integrate-open) and [Create (New)](https://developers.google.com/drive/api/guides/integrate-create) menu.

When developing a Drive app, if you do not use App Script and do not want to deploy a fake app in order to test it, you can use this app. All the code of this app runs on your browser and only needed data are sent to Google servers so you do not have to worry about privacy or security.

# Configuration

- You need to add **`https://datvm.github.io/`** URL to your **Website Restriction** of your API Key (or you can create a new Api Key for testing and remove it later)

![Add allowed URL to API Key](https://user-images.githubusercontent.com/6388546/208389048-49d0cc1c-fb48-497b-b1fd-04dc059275bb.png)

- You also need to add **`https://datvm.github.io`** to your OAuth2 Web credential's **Authorized Javascript Origin**

![Add Authorized Javascript Origins](https://user-images.githubusercontent.com/6388546/208385912-c0cef757-ec53-4b05-bf4f-b2245aa3f8ad.png)

- You also need to add your own account to the test user list if your app is still in `Testing` phase instead of `Production`

# Usage

Put in your project information and click `Create Client`.

Then you can simulate either request by picking files (multiple files and Google Docs formats supported) or folder.

![App UI](https://user-images.githubusercontent.com/6388546/208389685-3c651ed9-9fbc-4f40-ba8e-f0c0658c60a7.png)
