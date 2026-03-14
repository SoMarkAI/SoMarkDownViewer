# SoMarkDown Viewer 的双侧同步滚动策略

实现两侧同步滚动的前提是实现`data-line`的绑定机制。

## 1. 核心数据结构：映射表 (Mapping Map)

在滚动发生前，我们需要建立一张源文件行号与预览区垂直偏移量（Offset）的对应表。

1. **扫描预览区：** 遍历所有带有 `data-line` 属性的 DOM 节点。
2. **记录位置：** 获取该节点相对于预览容器顶部的 `offsetTop`。
3. **构建数组：** 形成一个对象数组，例如：
`[{ line: 1, top: 0 }, { line: 5, top: 120 }, { line: 10, top: 450 }, ...]`

---

## 2. 策略一：从编辑器同步到预览区 (Source -> Preview)

当你在编辑器中滚动时，步骤如下：

1. **获取当前行：** 获取编辑器视口顶部显示的第一行行号（假设为 $L_{current}$）。
2. **寻找锚点：** 在映射表中找到最接近 $L_{current}$ 的两个已知行号：
* $L_{upper}$：小于或等于 $L_{current}$ 的最大行。
* $L_{lower}$：大于 $L_{current}$ 的最小行。


3. **计算偏移比例：** 由于 $L_{current}$ 可能处于两个标记行之间，我们需要计算它在两行之间的相对进度：

$$Ratio = \frac{L_{current} - L_{upper}}{L_{lower} - L_{upper}}$$


4. **计算目标位置：**
利用该比例在对应的两个 DOM 偏移量之间进行**线性插值**：

$$TargetTop = Top_{upper} + (Top_{lower} - Top_{upper}) \times Ratio$$


5. **执行滚动：** 将预览窗口的 `scrollTop` 设置为 $TargetTop$。

---

## 3. 策略二：从预览区同步到编辑器 (Preview -> Source)

这是反向过程，逻辑相似但参照物不同：

1. **获取当前位置：** 获取预览区当前的 `scrollTop`（假设为 $T_{current}$）。
2. **寻找区间：** 在映射表中找到 $T_{current}$ 所在的两个 `top` 偏移量区间 $[Top_{upper}, Top_{lower}]$。
3. **计算位置比例：**

$$Ratio = \frac{T_{current} - Top_{upper}}{Top_{lower} - Top_{upper}}$$


4. **计算目标行号：**

$$TargetLine = L_{upper} + (L_{lower} - L_{upper}) \times Ratio$$


5. **执行滚动：** 调用编辑器的 API（如 VS Code 的 `revealLine`）滚动到 $TargetLine$。

---

## 4. 关键技术细节与优化

### A. 预防“死循环” (Scroll Loop)

这是最常见的问题：编辑器滚动导致预览滚动，预览滚动又反过来触发编辑器滚动。

* **解决方案：** 设置一个“锁定开关”（Lock）或“忽略标志”。当程序主动触发滚动时，暂时忽略该容器的 `onScroll` 事件回调。

### B. 顶部与底部的特殊处理

* **顶部：** 如果行号为 0，直接对齐。
* **底部：** 如果滚动到底部，直接强制同步，因为最后几行可能没有对应的 `data-line` 标签。

### C. 动态更新映射表

Markdown 内容是动态的。

* **策略：** 不要每滚动一次就计算一次全表。应该在**内容改变**、**窗口缩放**或**图片加载完成后**重新计算映射表。

### D. 顺滑度优化

为了避免滚动时的跳动感，可以使用 `requestAnimationFrame` 来平滑滚动效果，或者使用 CSS 的 `scroll-behavior: smooth`。

---

## 总结

这个策略的本质是**离散点的线性映射**。`data-line` 提供了散落在各处的“路标”，而对于路标之间的真空地带，我们通过百分比插值来填补，从而实现丝滑的同步感。
