Mock Tool
===========================

A mock tool for Vue2

## Usage
# vue.config.js
```javascript
module.exports = { 
devServer: {
    port: 3000,
    disableHostCheck: true,
    https: false,
    proxy: require('mock-tool')(
      ['http://a.com'],
      ['/api'],
      { logLevel: 'debug' }
    ),
  },
}