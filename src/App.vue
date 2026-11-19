<script setup lang="ts">
// 全局样式放在这里；页面内容由 pages.json 中的路由决定。
</script>

<style>
page {
  background: #f7f8f2;
  color: #273e35;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

view,
text,
button {
  box-sizing: border-box;
}

button {
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

button::after {
  border: 0;
}

button:focus-visible {
  outline: 3px solid #a56b34;
  outline-offset: 5px;
}
</style>
