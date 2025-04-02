const { notarize } = require("electron-notarize");
const { build } = require("../package.json");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize on Mac
  if (electronPlatformName !== "darwin") {
    return;
  }

  // Get app name from the build info
  const appName = context.packager.appInfo.productFilename;
  const appBundleId = build.appId;

  console.log(`Notarizing ${appName} with bundle identifier ${appBundleId}`);

  // Environment variables should be set in your CI/CD pipeline or local environment
  // export APPLE_ID=your.apple.id@example.com
  // export APPLE_ID_PASSWORD=app-specific-password
  // export TEAM_ID=your-team-id

  try {
    await notarize({
      appBundleId,
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.TEAM_ID || "7X2UF4FZHC",
    });
    console.log(`Successfully notarized ${appName}`);
  } catch (error) {
    console.error("Error during notarization:", error);
    throw error;
  }
};
