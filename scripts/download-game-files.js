/**
 * This code is from csfloat repo. I made small changes to get the images.
 * https://github.com/csfloat/cs-files/blob/5ff0f212ff0dc2b6f6380fc6d1a93121c2b9c2cd/index.js
 */
const SteamUser = require("steam-user");
const SteamTotp = require('steam-totp')

const fs = require("fs");
const vpk = require("vpk");
const util = require("util");
const path = require("path");

const appId = 730;
const depotId = 2347770;
const dir = path.join(__dirname, "..", "static");
const temp = path.join(__dirname, "..", "temp");
const manifestIdFile = "manifestId.txt";

let fileShaContent = {};
let fileShaContentUpdated = {};
let fileShaContentDiff = {};

const vpkFolders = [
    "panorama/images/econ/characters",
    "panorama/images/econ/default_generated",
    "panorama/images/econ/music_kits",
    "panorama/images/econ/patches",
    "panorama/images/econ/season_icons",
    "panorama/images/econ/set_icons",
    "panorama/images/econ/status_icons",
    "panorama/images/econ/stickers",
    "panorama/images/econ/tools",
    "panorama/images/econ/weapons",
    "panorama/images/econ/weapon_cases",
    "panorama/images/econ/tournaments",
    "panorama/images/econ/premier_seasons",
];

const delay = util.promisify(setTimeout);

const accountName = process.argv[2];
const password = process.argv[3];
const optionalSharedSecretOrFlag = process.argv[4] || "";

// 第 4 个业务参数如果是 --force/--recheck，说明使用的是旧命令格式；否则按 Steam shared_secret 处理。
const sharedSecret = optionalSharedSecretOrFlag.startsWith("--") ? "" : optionalSharedSecretOrFlag;

// shared_secret 之后才是真正的运行参数；这里兼容旧格式，避免本地老命令突然不可用。
const flags = optionalSharedSecretOrFlag.startsWith("--")
    ? process.argv.slice(4)
    : process.argv.slice(5);
const forceUpdate = flags.includes("--force");
const recheckManifest = flags.includes("--recheck");

async function downloadVPKDir(user, manifest) {
    const dirFile = manifest.manifest.files.find((file) =>
        file.filename.endsWith("csgo\\pak01_dir.vpk")
    );

    console.log(`Downloading vpk dir`);

    try {
        await user.downloadFile(appId, depotId, dirFile, `${temp}/pak01_dir.vpk`);
    } catch (error) {
        if (error instanceof AggregateError) {
            console.error(`❌ Failed to download pak01_dir.vpk: Multiple errors occurred`);
            error.errors.forEach(e => console.error(e));
        } else {
            console.error(`❌ Failed to download pak01_dir.vpk: ${error}`);
        }
        return null; // Return null to handle failure gracefully
    }

    const vpkDir = new vpk(`${temp}/pak01_dir.vpk`);
    vpkDir.load();

    return vpkDir;
}

function getRequiredVPKFiles(vpkDir) {
    const requiredIndices = [];

    for (const fileName of vpkDir.files) {
        for (const f of vpkFolders) {
            if (fileName.startsWith(f)) {
                // console.log(`Found vpk for ${f}: ${fileName}`);

                const archiveIndex = vpkDir.tree[fileName].archiveIndex;

                const fileShaIsDifferent = fileShaContentDiff[archiveIndex.toString().padStart(3, "0")] || forceUpdate;

                if (!requiredIndices.includes(archiveIndex) && fileShaIsDifferent) {
                    requiredIndices.push(archiveIndex);
                }

                break;
            }
        }
    }

    return requiredIndices.sort((a, b) => a - b);
}

async function downloadWithRetry(user, appId, depotId, file, filePath, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await user.downloadFile(appId, depotId, file, filePath);
            return true;
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            const backoffTime = Math.min(60000 * Math.pow(2, attempt - 1), 300000); // 1min, 2min, 4min, max 5min
            console.log(`⚠️ Download failed, retrying in ${backoffTime/60000} minutes (attempt ${attempt}/${maxRetries})`);
            await delay(backoffTime);
        }
    }
}

async function downloadVPKArchives(user, manifest, vpkDir) {
    if (!vpkDir) {
        console.error("⚠️ Skipping VPK archive downloads due to previous failure.");
        return;
    }

    const requiredIndices = getRequiredVPKFiles(vpkDir);
    const failedDownloads = [];

    for (let index = 0; index < requiredIndices.length; index++) {
        const archiveIndex = requiredIndices[index];
        const paddedIndex = archiveIndex.toString().padStart(3, "0");
        const fileName = `pak01_${paddedIndex}.vpk`;

        const file = manifest.manifest.files.find((f) =>
            f.filename.endsWith(fileName)
        );
        const filePath = `${temp}/${fileName}`;

        const status = `[${index + 1}/${requiredIndices.length}]`;
        console.log(`${status} Downloading ${fileName}`);

        try {
            await downloadWithRetry(user, appId, depotId, file, filePath);
            console.log(`✅ Successfully downloaded ${fileName}`);
        } catch (error) {
            if (error instanceof AggregateError) {
                console.error(`❌ Failed to download ${fileName}:`);
                error.errors.forEach(e => console.error(`  - ${e.message}`));
            } else {
                console.error(`❌ Failed to download ${fileName}: ${error}`);
            }
            failedDownloads.push(fileName);
        }

        // Increased delay between downloads to 5 seconds
        await delay(5000);
    }

    if (failedDownloads.length > 0) {
        console.log("\n⚠️ The following files failed to download:");
        failedDownloads.forEach(file => console.log(`  - ${file}`));
    }
}

async function getChangedFiles(manifest) {
    try {
        fileShaContent = JSON.parse(await fs.promises.readFile(`${dir}/fileSha.json`, 'utf8')) || {};
        fileShaContentUpdated = { ...fileShaContent };
    } catch (err) {
        console.error(`❌ Error reading fileSha.json: ${err.message}`);
    }

    manifest.manifest.files.filter((file) => file.filename.startsWith("game\\csgo\\pak01_")).forEach((file) => {
        const vpkIndex = file.filename.replace('game\\csgo\\pak01_', '').replace('.vpk', '');

        if (!['dir'].includes(vpkIndex)) {
            fileShaContentUpdated[vpkIndex] = file.sha_content;
        }
    });

    for (const key in fileShaContentUpdated) {
        if (fileShaContentUpdated[key] !== fileShaContent[key]) {
            fileShaContentDiff[key] = fileShaContentUpdated[key];
        }
    }
}

if (!accountName || !password || process.argv.length > 6) {
    console.error(
        "Usage: node scripts/download-game-files.js <username> <password> [shared_secret] [--recheck|--force]"
    );
    process.exit(1);
}

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

if (!fs.existsSync(temp)) {
    fs.mkdirSync(temp);
}

const user = new SteamUser();

console.log("Logging into Steam....");

// GitHub Actions 会把 SHARED_SECRET 作为第 3 个业务参数传入；为空时沿用 Steam 的普通登录流程。
const twoFactorCode = sharedSecret ? SteamTotp.getAuthCode(sharedSecret) : undefined;

user.logOn({
    accountName,
    password,
    twoFactorCode: twoFactorCode,
    rememberPassword: true,
    logonID: 2121,
});

user.once("loggedOn", async () => {
    console.log("✅ Logged into Steam");

    let latestManifestId;
    try {
        const cs = (await user.getProductInfo([appId], [], true)).apps[appId]
            .appinfo;
        const commonDepot = cs.depots[depotId];
        latestManifestId = commonDepot.manifests.public.gid;

        console.log(`📦 Obtained latest manifest ID: ${latestManifestId}`);
    } catch (error) {
        console.error(`❌ Failed to retrieve manifest ID: ${error.message}`);
        process.exit(1);
    }

    let existingManifestId = "";

    try {
        existingManifestId = fs.readFileSync(`${dir}/${manifestIdFile}`);
    } catch (err) {
        if (err.code !== "ENOENT") {
            console.error(`❌ Error reading manifest ID file: ${err.message}`);
            throw err;
        }
    }

    if (existingManifestId == latestManifestId && !recheckManifest && !forceUpdate) {
        console.log("⚠️ Latest manifest ID matches existing manifest ID, exiting.");
        process.exit(0);
    }

    console.log("🔄 Manifest ID changed or force flag used, downloading new files...");

    let manifest;
    try {
        manifest = await user.getManifest(appId, depotId, latestManifestId, "public");
    } catch (error) {
        console.error(`❌ Failed to get manifest: ${error.message}`);
        process.exit(1);
    }

    await getChangedFiles(manifest);

    const vpkDir = await downloadVPKDir(user, manifest);
    await downloadVPKArchives(user, manifest, vpkDir);

    try {
        fs.writeFileSync(`${dir}/${manifestIdFile}`, latestManifestId);
        fs.writeFileSync(`${dir}/fileSha.json`, JSON.stringify(fileShaContentUpdated, null, 2));
        console.log("✅ Updated manifest ID file.");
    } catch (error) {
        console.error(`❌ Failed to write manifest ID file: ${error.message}`);
    }

    console.log("🎉 Done!");
    process.exit(0);
});
