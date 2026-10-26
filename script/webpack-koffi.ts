import webpack from 'webpack'

/** Bundle only the target's native Koffi package, even during cross-compilation. */
export function getKoffiWebpackConfig(
  nodeModulesRoot: string,
  platform: NodeJS.Platform,
  arch: string
): webpack.Configuration {
  const targetPackage = `@koromix/koffi-${platform}-${arch}`
  // Koffi catches missing optional packages. Resolve eagerly so a missing target
  // fails the build instead of producing an app that cannot load the SDK.
  const entry = require.resolve(targetPackage, { paths: [nodeModulesRoot] })
  // Koffi's ESM fallback contains import.meta.dirname, which cannot execute in
  // Electron's CommonJS renderer chunks. Its CJS entry exports the same API.
  const koffiEntry = require.resolve('koffi', { paths: [nodeModulesRoot] })

  return {
    resolve: {
      alias: { koffi$: koffiEntry, [`${targetPackage}$`]: entry },
    },
    plugins: [
      new webpack.IgnorePlugin({
        checkResource: request =>
          request.startsWith('@koromix/koffi-') && request !== targetPackage,
      }),
    ],
  }
}
