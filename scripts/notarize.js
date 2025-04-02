require("dotenv").config();
const path = require("path");

exports.default = async function notarizing(context) {
  // Skip notarization in development mode
  if (process.env.CSC_FORCE_SIGN === "false") {
    console.log("Skipping notarization in development mode");
    return;
  }

  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") {
    return;
  }

  console.log("Notarizing macOS application...");

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  try {
    // Using dynamic import() for @electron/notarize
    const { notarize } = await import("@electron/notarize");

    await notarize({
      tool: "notarytool",
      appPath,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
    });
    console.log(`Successfully notarized ${appName}`);
  } catch (error) {
    console.error("Error during notarization:", error);
    throw error;
  }
};
