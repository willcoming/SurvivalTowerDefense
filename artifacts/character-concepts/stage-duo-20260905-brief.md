# 兩位新角色：舞台戰鬥造型概念稿

狀態：服裝／髮型方向已核准；使用者另要求畫風必須與既有角色一致，因此這張半寫實概念稿不是正式畫風基準，最終立繪沿用 C01／C02 的 2D 動漫畫風。已衍生為原訂 C07 汐音（淺金長直髮）／C08 熾夏（黑色長捲髮）的原裝與夏日裝，共四張立繪；原裝保留 stage-v3，夏日依「不同主題的姿勢要不同」更新為 pose-v4。概念稿本身不直接用於戰鬥；沒有新增角色 ID 或修改獎池／戰鬥數值。

使用者確認：新角色維持 2 位；以提供的照片作造型參考，不要潛水服。

生成模式：內建 imagegen，單張雙角色概念圖。

參考照片：`/tmp/codex-remote-attachments/01a06f55-1a66-7973-a19a-c30b66e23f19/E5AAFD10-0676-4C94-85C8-346CF2066D7E/1-照片-1.jpg`

預覽原始圖：`/Users/willcoming/.codex/generated_images/01a06f55-1a66-7973-a19a-c30b66e23f19/exec-43e9910f-36e7-49f1-9c57-99c403fa5123.png`

方向：淺金長直髮／黑色長捲髮；黑白銀舞台服裝與科幻武裝。無潛水裝備。保留汐音地雷工程／熾夏過熱機槍的既有定位，原裝與夏日裝維持各自的形態 ID 與屬性。

## 遊戲立繪

- 汐音原裝：`public/assets/forms/C07-original-stage-v3.webp`
- 汐音夏日裝：`public/assets/forms/C07-summer-pose-v4.webp`，側身回望、抬手托起浮標地雷。
- 熾夏原裝：`public/assets/forms/C08-original-stage-v3.webp`
- 熾夏夏日裝：`public/assets/forms/C08-summer-pose-v4.webp`，側步迎風、旋轉砲斜向下雙手提持。

四張均以內建 imagegen 製作；每張完整編輯提示詞與原始圖路徑記錄在 `artifacts/collection-sources/generated.json`。舊版立繪與生成原圖保留，僅改變遊戲引用的版本檔名。

主題姿勢規則見 [角色畫風基準](../../docs/CHARACTER_ART_DIRECTION.md)：角色識別與畫風一致，動作不共用；這次只重繪兩位新角色的夏日立繪。汐音 pose-v4 第一版的多餘手臂已由 imagegen 修正，瑕疵圖未打包至遊戲，來源與修正提示詞仍保留供追溯。

## 概念稿完整提示詞

```text
Use case: stylized-concept.
Asset type: one two-character game concept illustration, preview only.
Input image 1 is a FASHION AND HAIRSTYLE reference, not an edit target. Create exactly TWO distinct original adult female anime characters for a science-fiction tower-defense game, inspired by the reference's black, white and silver stage-fashion styling. Do not reproduce the four-person photo or its backstage background.
Composition: a clean side-by-side full-body character lineup on a warm pale-grey studio background, both characters equally prominent, separate readable silhouettes, all hair, hands, equipment and boots inside frame. Eye-level neutral standing hero poses, beautiful detailed contemporary anime game key art, crisp linework, soft painterly shading and polished metal highlights. No text, labels, logos, extra figures or inset portraits.
First design: adult woman about 26, long straight pale-blonde hair, cool confident expression, a silver-and-white cropped structured stage top with a restrained soft feather shoulder accent, black high-waisted tailored shorts, silver belt and small metallic tassels, black mid-calf boots. Integrate understated futuristic wrist armor and a compact silver sci-fi sidearm held safely lowered.
Second design: adult woman about 27, long flowing black wavy hair, poised focused expression, a white sleeveless structured cropped top with fine black-and-white linear strap detailing, black short asymmetric skirt with built-in shorts, silver chain and fringe accents, black tall boots. Integrate slim futuristic forearm armor and a compact black-and-silver energy carbine held safely lowered.
The pair must look like a coherent team but clearly different people. Translate fashion details into original game costumes; keep the fashionable stage feeling rather than generic bulky soldiers. Fully clothed, non-explicit, anatomically natural adult proportions.
Strict exclusions: no wetsuits, scuba suits, diving goggles, flippers, oxygen tanks, swim fins, underwater gear, full-body latex suits, school uniforms, childlike proportions, magenta chroma background or photorealistic faces.
```
