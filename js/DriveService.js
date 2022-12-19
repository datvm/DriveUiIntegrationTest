const JsonMime = "application/json";
const GsiUrl = "https://accounts.google.com/gsi/client";
const GApiUrl = "https://apis.google.com/js/api.js";
export class DriveService {
    #oauth;
    #supportAllDrives = false;
    #accResolve;
    #client;
    #cachedToken;
    constructor(oauth, supportAllDrives) {
        this.#oauth = oauth;
        this.#supportAllDrives = supportAllDrives;
    }
    static async createAsync(oauth, supportAllDrives) {
        const service = new DriveService(oauth, supportAllDrives);
        await service.#initAsync();
        return service;
    }
    static #importScriptAsync(url) {
        return new Promise((res, rej) => {
            const script = document.createElement("script");
            script.async = true;
            script.onload = res;
            script.onerror = rej;
            script.src = url;
            document.body.appendChild(script);
        });
    }
    async #initAsync() {
        await DriveService.#importScriptAsync(GsiUrl);
        const o = this.#oauth;
        this.#client = google.accounts.oauth2.initTokenClient({
            client_id: o.clientId,
            callback: (acc) => this.#onAccountReceived(acc),
            scope: o.scope,
            prompt: "",
        });
        await DriveService.#importScriptAsync(GApiUrl);
        await new Promise(r => gapi.load("picker", r));
    }
    #onAccountReceived(acc) {
        if (!this.#accResolve) {
            return;
        }
        const fn = this.#accResolve;
        this.#accResolve = undefined;
        fn(acc);
    }
    async getTokenAsync(force = false, forceSelectAccount = false) {
        if (this.#cachedToken && !force) {
            return this.#cachedToken;
        }
        const acc = await new Promise(r => {
            this.#accResolve = r;
            const overrides = {};
            if (forceSelectAccount) {
                overrides.prompt = "select_account";
            }
            this.#client.requestAccessToken(overrides);
        });
        return this.#cachedToken = acc?.access_token;
    }
    async listFilesInFolderAsync(parentId, token) {
        token ??= await this.getTokenAsync();
        const params = new URLSearchParams();
        params.append("q", `'${parentId}' in parents`);
        params.append("supportsAllDrives", this.#supportAllDrives.toString());
        const url = "https://www.googleapis.com/drive/v3/files?" + params.toString();
        const res = await fetch(url, {
            headers: {
                "Authorization": "Bearer " + token,
            }
        });
        if (!res.ok) {
            throw new Error(await res.text());
        }
        return (await res.json()).files;
    }
    async saveFileAsync(blob, name, parentId, token) {
        token ??= await this.getTokenAsync();
        const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=" + this.#supportAllDrives;
        const body = new FormData();
        body.append("metadata", new Blob([JSON.stringify({
                name,
                parents: parentId ? [parentId] : undefined,
            })], { type: JsonMime }));
        body.append("media", blob);
        const res = await fetch(url, {
            method: "POST",
            body,
            headers: {
                "Authorization": "Bearer " + token,
            },
        });
        if (!res.ok) {
            throw new Error(await res.text());
        }
        return await res.json();
    }
    async pickFileAsync(options) {
        return (await this.#internalPickFilesAsync(options, false))?.[0];
    }
    async pickFilesAsync(options) {
        return await this.#internalPickFilesAsync(options, true);
    }
    async #internalPickFilesAsync(options, multiple) {
        const o = options ?? {};
        return await this.showPickerAsync(o.token, view => {
            if (o.mime) {
                view.setMimeTypes(o.mime);
            }
        }, builder => {
            if (multiple) {
                builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
            }
        });
    }
    async pickFolderAsync(token) {
        const folders = await this.showPickerAsync(token, view => {
            view.setIncludeFolders(true);
            view.setSelectFolderEnabled(true);
            view.setMimeTypes(DriveFolderMime);
        }, () => new google.picker.DocsView(google.picker.ViewId.FOLDERS));
        return folders?.[0];
    }
    detectDriveIntegration() {
        const params = new URLSearchParams(location.search);
        const state = params.get("state");
        if (!state) {
            return undefined;
        }
        let obj;
        try {
            obj = JSON.parse(state);
        }
        catch (_) {
            return undefined;
        }
        if (!obj) {
            return undefined;
        }
        const result = {};
        if (obj.action === "create") {
            result.new = obj;
        }
        else if (obj.action === "open") {
            result.open = obj;
        }
        else {
            return undefined;
        }
        if (result.new) {
            if (result.new.action !== "create" || !result.new.folderId) {
                return undefined;
            }
        }
        else if (result.open) {
            if (result.open.action !== "open" ||
                !(result.open.exportIds || result.open.ids)) {
                return undefined;
            }
        }
        return result;
    }
    getExportInfo(mimeOrFile) {
        if (mimeOrFile instanceof Object) {
            mimeOrFile = mimeOrFile.mimeType;
        }
        const type = DriveGoogleDocsMime[mimeOrFile];
        return {
            isGoogleDoc: type !== undefined,
            type,
            exportMimes: type === undefined ? undefined : DriveExportMime[type],
        };
    }
    async showPickerAsync(token, viewSettings, builderSettings, viewFunc) {
        const res = await new Promise(async (r) => {
            token ??= await this.getTokenAsync();
            if (!token) {
                r(undefined);
            }
            const view = viewFunc?.() ?? new google.picker.DocsView();
            viewSettings?.(view);
            const o = this.#oauth;
            const builder = new google.picker.PickerBuilder();
            builder
                .addView(view)
                .setAppId(o.projectNumber)
                .setDeveloperKey(o.apiKey)
                .setOAuthToken(token)
                .setCallback((data) => {
                switch (data.action) {
                    case google.picker.Action.PICKED:
                        r(data);
                        break;
                    case google.picker.Action.CANCEL:
                        r(data);
                        break;
                }
            });
            if (this.#supportAllDrives) {
                builder.enableFeature(google.picker.Feature.SUPPORT_DRIVES);
            }
            builderSettings?.(builder);
            const picker = builder.build();
            picker.setVisible(true);
        });
        if (!res || res.action !== "picked") {
            return undefined;
        }
        return res.docs;
    }
    async readFileAsync(file, token) {
        var info = this.getExportInfo(file);
        return info.isGoogleDoc ?
            await this.exportFileAsync(file.id, info.exportMimes[0], token) :
            await this.downloadFileAsync(file.id, token);
    }
    async readFileAsTextAsync(file, token) {
        var info = this.getExportInfo(file);
        return info.isGoogleDoc ?
            await this.exportFileAsTextAsync(file.id, info.exportMimes[0], token) :
            await this.downloadFileAsTextAsync(file.id, token);
    }
    async downloadFileAsync(id, token) {
        const res = await this.#internalDownloadFileAsync(id, token);
        return await res.arrayBuffer();
    }
    async downloadFileAsTextAsync(id, token) {
        const res = await this.#internalDownloadFileAsync(id, token);
        return await res.text();
    }
    async exportFileAsync(id, exportType, token) {
        const res = await this.#internalImportFileAsync(id, exportType, token);
        return await res.arrayBuffer();
    }
    async exportFileAsTextAsync(id, exportType, token) {
        const res = await this.#internalImportFileAsync(id, exportType, token);
        return await res.text();
    }
    async #internalImportFileAsync(id, exportType, token) {
        token ??= await this.getTokenAsync();
        if (!token) {
            throw new Error("Unauthorized");
        }
        const params = new URLSearchParams();
        params.append("alt", "media");
        params.append("supportsAllDrives", this.#supportAllDrives.toString());
        params.append("mimeType", exportType);
        const url = "https://www.googleapis.com/drive/v3/files/"
            + encodeURI(id) + "/export?" + params.toString();
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token,
            }
        });
        if (!res.ok) {
            throw new Error(await res.text());
        }
        return res;
    }
    async #internalDownloadFileAsync(id, token) {
        token ??= await this.getTokenAsync();
        if (!token) {
            throw new Error("Unauthorized");
        }
        const url = "https://www.googleapis.com/drive/v3/files/"
            + encodeURI(id) + "?alt=media&supportsAllDrives=" + this.#supportAllDrives;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token,
            }
        });
        if (!res.ok) {
            throw new Error(await res.text());
        }
        return res;
    }
}
export const DriveFolderMime = "application/vnd.google-apps.folder";
export const DriveExportMime = {
    document: [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.oasis.opendocument.text",
        "application/rtf",
        "application/pdf",
        "text/plain",
        "application/zip",
        "application/epub+zip",
    ],
    spreadsheet: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/x-vnd.oasis.opendocument.spreadsheet",
        "application/pdf",
        "application/zip",
        "text/csv",
        "text/tab-separated-values",
    ],
    presentation: [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.oasis.opendocument.presentation",
        "application/pdf",
        "text/plain",
        "image/jpeg",
        "image/png",
        "image/svg+xml",
    ],
    drawing: [
        "applcation/pdf",
        "image/jpeg",
        "image/png",
        "image/svg+xml",
    ],
    appScript: [
        "application/vnd.google-apps.script+json",
    ],
};
export const DriveGoogleDocsMime = {
    "application/vnd.google-apps.document": "document",
    "application/vnd.google-apps.spreadsheet": "spreadsheet",
    "application/vnd.google-apps.presentation": "presentation",
    "application/vnd.google-apps.drawing": "drawing",
    "application/vnd.google-apps.script": "appScript",
};
