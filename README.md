# undertaker-packaging

[Undertaker](https://www.npmjs.com/package/undertaker) registry for creating .pkg files for OSX.

## Installation

```bash
npm install --save-dev undertaker-packaging
```

## Usage


```javascript
// gulpfile.js

const PackagingRegistery = require('undertaker-packaging')

gulp.registry(new PackagingRegistery({
  title: 'MyApp', // package title
  id: 'com.me.my-app', // package identifier
  path: './src', // path to files to package
  version: '1.0.0', // package version
  outputPath: './bin'), // path where generated package will be created
  installPath: '/Applications/MyApp', // path for package to install files to
}))
```

Then run the packaging task from Gulp.

```
gulp packaging
```

You should now see ````MyApp-1.0.0.pkg```` in the bin directory.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## Todos

* Document advanced functionality.
* Implement equivalent for Windows.
* Add more tests.

## License

The MIT License (MIT)
