# VSCode WebView 样式问题排查指南

## 问题描述

在VSCode扩展的WebView中，CSS样式文件无法正确加载，开发者工具控制台报错：

```
Not allowed to load local resource: file:///d%3A/aicode/promot-helper/media/styles.css
```

## 问题原因

VSCode WebView有严格的安全限制，不允许直接通过`file://`协议访问本地文件系统资源。在WebView中加载本地资源（如CSS、JavaScript、图片等）需要通过VSCode API提供的特殊方法来转换URI。

## 解决方案

### 1. 正确使用`asWebviewUri`方法

将本地文件路径转换为WebView可以访问的URI：

```typescript
// 错误方式
const styleUri = vscode.Uri.joinPath(this.extensionUri, 'media/styles.css');

// 正确方式
const localUri = vscode.Uri.joinPath(this.extensionUri, 'media/styles.css');
const styleUri = this._webview.asWebviewUri(localUri);
```

### 2. 确保正确设置WebView的`localResourceRoots`

在初始化WebView时，必须设置允许访问的本地资源根目录：

```typescript
webviewView.webview.options = { 
  enableScripts: true,
  localResourceRoots: [
    vscode.Uri.joinPath(this._extensionUri, 'media')
  ]
};
```

### 3. 在WebView HTML中设置正确的Content-Security-Policy

确保CSP中包含对样式的允许：

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               style-src ${this._webview.cspSource} 'unsafe-inline'; 
               img-src ${this._webview.cspSource} https:; 
               script-src 'unsafe-inline';">
```

其中`${this._webview.cspSource}`会被替换为WebView的CSP源，这是允许加载资源所必需的。

### 4. 确保资源文件包含在发布包中

在`.vscodeignore`文件中确保不要忽略资源文件：

```
# 不要忽略media目录
!media/**
```

## 调试技巧

1. 使用WebView的开发者工具查看网络请求和控制台错误
2. 检查HTML中资源的实际URL格式是否正确
3. 确认本地资源文件确实存在于指定位置

## 参考文档

- [VSCode WebView 官方文档](https://code.visualstudio.com/api/extension-guides/webview)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) 