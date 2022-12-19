import { DriveService } from "./DriveService.js";
const OauthStorageKey = "oauth";
const AppUrlKey = "appUrl";
new class {
    #drive;
    #grpInit = document.querySelector(".grp-init");
    #grpIntegration = document.querySelector(".grp-integration");
    #txtAppUrl = document.querySelector("#txt-url");
    constructor() {
        document.querySelector(".btn-create-client")?.addEventListener("click", () => void this.#createClient());
        document.querySelector("[data-simulate=open]")?.addEventListener("click", () => void this.#simulateAsync(true));
        document.querySelector("[data-simulate=new]")?.addEventListener("click", () => void this.#simulateAsync(false));
        this.#fillStoredOauth();
    }
    #fillStoredOauth() {
        const oauth = localStorage.getItem(OauthStorageKey);
        if (!oauth)
            return;
        try {
            const data = JSON.parse(oauth);
            document.querySelectorAll("[data-oauth]").forEach((el) => {
                const key = el.getAttribute("data-oauth");
                if (data[key])
                    el.value = data[key];
            });
        }
        catch {
            localStorage.removeItem(OauthStorageKey);
        }
        const appUrl = localStorage.getItem(AppUrlKey);
        if (appUrl) {
            this.#txtAppUrl.value = appUrl;
        }
    }
    async #createClient() {
        this.#grpInit.disabled = true;
        const oauth = {};
        document.querySelectorAll("[data-oauth]").forEach((el) => {
            const key = el.getAttribute("data-oauth");
            oauth[key] = el.value;
        });
        try {
            this.#drive = await DriveService.createAsync(oauth, true);
            await this.#drive.getTokenAsync();
        }
        catch (e) {
            console.error(e);
            alert("Error initializing the client. See details error in Console. " + e);
            this.#drive = undefined;
        }
        localStorage.setItem(OauthStorageKey, JSON.stringify(oauth));
        this.#grpInit.disabled = Boolean(this.#drive);
        this.#grpIntegration.disabled = !Boolean(this.#drive);
    }
    async #simulateAsync(open) {
        const state = await (open ?
            this.#simulateOpenAsync() :
            this.#simulateCreateAsync());
        if (!state)
            return;
        const appUrl = this.#txtAppUrl.value;
        if (!appUrl)
            return;
        const url = new URL("?state=" + encodeURIComponent(state), appUrl);
        window.open(url.toString(), "_blank");
        localStorage.setItem(AppUrlKey, appUrl);
    }
    async #simulateOpenAsync() {
        if (!this.#drive) {
            return;
        }
        const files = await this.#drive.pickFilesAsync();
        if (!files?.length)
            return;
        const openIds = [];
        const exportIds = [];
        for (const file of files) {
            const info = this.#drive.getExportInfo(file);
            if (info.isGoogleDoc) {
                exportIds.push(file.id);
            }
            else {
                openIds.push(file.id);
            }
        }
        return JSON.stringify({
            ids: openIds.length ? openIds : undefined,
            exportIds: exportIds.length ? exportIds : undefined,
            action: "open",
            userId: "me",
        });
    }
    async #simulateCreateAsync() {
        if (!this.#drive) {
            return;
        }
        const folder = await this.#drive.pickFolderAsync();
        if (!folder) {
            return;
        }
        return JSON.stringify({
            action: "create",
            folderId: folder.id,
            userId: "me",
        });
    }
}();
