const KV_KEY = "single_file_store";
const MAX_SIZE = 26214400; // 25MB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(pageHtml(), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      if (!file) return resMsg("未选择文件", 400);
      if (file.size > MAX_SIZE) return resMsg("文件超过25MB限制", 400);

      const buf = await file.arrayBuffer();
      await env.FILE_KV.put(KV_KEY, buf, {
        metadata: { name: file.name, size: file.size }
      });
      return resMsg("上传成功");
    }

    if (url.pathname === "/download") {
      const { value, metadata } = await env.FILE_KV.getWithMetadata(KV_KEY, "arrayBuffer");
      if (!value) return resMsg("无文件", 404);
      return new Response(value, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.name)}"`
        }
      });
    }

    if (url.pathname === "/delete") {
      await env.FILE_KV.delete(KV_KEY);
      return resMsg("已删除");
    }

    if (url.pathname === "/info") {
      const { metadata } = await env.FILE_KV.getWithMetadata(KV_KEY);
      return new Response(JSON.stringify({
        exist: !!metadata,
        name: metadata?.name || "",
        size: metadata?.size || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return resMsg("404");
  }
};

function resMsg(text, status = 200) {
  return new Response(text, { status });
}

function pageHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EdgeCache 边缘缓存</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:system-ui}
body{max-width:450px;margin:60px auto;padding:0 20px}
.box{border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px}
.tip{color:#ef4444;font-size:14px;margin:8px 0}
.info{background:#f9fafb;padding:12px;border-radius:8px;margin:12px 0}
button{padding:9px 18px;border:none;border-radius:8px;cursor:pointer;margin:6px 4px}
.btn-blue{background:#3b82f6;color:#fff}
.btn-red{background:#ef4444;color:#fff}
#status{margin-top:12px;color:#16a34a}
#uploadArea, #fileArea{display:none}
</style>
</head>
<body>

<div id="uploadArea" class="box">
  <h3>上传文件</h3>
  <p class="tip">最大25MB，仅保存1个</p>
  <input type="file" id="file">
  <div id="status"></div>
</div>

<div id="fileArea" class="box">
  <h3>当前文件</h3>
  <div class="info" id="fileInfo"></div>
  <button class="btn-blue" onclick="download()">下载</button>
  <button class="btn-red" onclick="delFile()">删除</button>
</div>

<script>
function fmtSize(b){
  if(b<1024)return b+'B';
  if(b<1048576)return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}

async function loadInfo(){
  const res=await fetch('/info');
  const d=await res.json();
  
  const uploadArea = document.getElementById('uploadArea');
  const fileArea = document.getElementById('fileArea');
  const fileInfo = document.getElementById('fileInfo');

  if(!d.exist){
    uploadArea.style.display = 'block';
    fileArea.style.display = 'none';
    return;
  }

  uploadArea.style.display = 'none';
  fileArea.style.display = 'block';
  fileInfo.innerText = '文件名：'+d.name+'\\n大小：'+fmtSize(d.size);
}

// 选择文件后自动上传
document.getElementById('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  
  status('上传中...','#3b82f6');
  const fd = new FormData();
  fd.append('file', f);
  
  const res = await fetch('/upload', { method:'POST', body:fd });
  status(await res.text(), res.ok ? 'green' : 'red');
  
  setTimeout(loadInfo, 800);
});

function download(){window.location.href='/download'}
async function delFile(){
  if(!confirm('确定删除？'))return;
  await fetch('/delete');
  status('已删除','green');
  loadInfo();
}

function status(txt,c){
  const el=document.getElementById('status');
  el.innerText=txt;el.style.color=c;
}

window.onload=loadInfo;
</script>
</body>
</html>
  `;
}