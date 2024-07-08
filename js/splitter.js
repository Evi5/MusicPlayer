let startX, initialWidth, leftPanel, isDragging = false;
function dragStart(e) {
    if (e.target.classList.contains('splitter')) {
        e.preventDefault();
        startX = e.clientX; // 记录鼠标按下时的X坐标
        initialWidth = parseFloat(getComputedStyle(e.target.previousElementSibling).width); // 获取左侧面板的当前宽度
        isDragging = true; // 设置拖拽状态为真
        document.addEventListener('mousemove', dragging);
        document.addEventListener('mouseup', dragEnd);
        // 设置拖拽开始的其他逻辑
        leftPanel = document.querySelector('.left-panel');
    }
}


function dragging(e) {
    if (isDragging) {
        const currentX = e.clientX;
        const offset = currentX - startX; // 计算鼠标移动的距离
        const newWidth = initialWidth + offset; // 计算新的宽度

        // 设置左侧面板的新宽度
        leftPanel.style.width = `${newWidth}px`;
    }
}

function dragEnd(e) {
    // 清理事件监听器
    document.removeEventListener('mousemove', dragging);
    document.removeEventListener('mouseup', dragEnd);
    isDragging = false
}


function toast(message, color) {
  // 创建新的toast元素
  const toast = document.createElement('div');
  toast.classList.add('toast');
  toast.textContent = message;
  toast.style.color = color || 'white'; // 默认文字颜色为白色

  // 将新toast插入到容器的第一个子元素之前
  const container = document.getElementById('toast-container');
  container.insertBefore(toast, container.firstChild);

  // 显示toast
  setTimeout(() => {
    toast.classList.add('toast-enter');

    // 为已存在的toast添加向下移动的效果
    Array.from(container.children).slice(1).forEach((otherToast, index) => {
      otherToast.style.transform = `translateY(${(index + 1) * 20}px)`;
      setTimeout(() => {
        otherToast.style.transform = 'translateY(0)';
      }, 300);
    });
  }, 100);

  // 设置延迟消失
  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');

    // 重置所有 toast 的 transform 属性
    Array.from(container.children).forEach((t, i) => {
      t.style.transform = '';
    });

    // 消失动画结束后移除toast
    toast.addEventListener('transitionend', () => {
      if (toast.classList.contains('toast-exit')) {
        toast.remove();
      }
    });
  }, 3000); // 3秒后消失
}


// 编辑按钮
document.getElementById('animated-button').addEventListener('mousedown', function() {
  const svg = this.querySelector('svg');
  svg.classList.add('click-animation');

  // Remove the animation class after the animation duration to allow re-triggering
  setTimeout(() => {
    svg.classList.remove('click-animation');
  }, 400); // Match the duration of the animation
});


// 编辑器显示的开关
function toggleModal() {
    var modal = document.getElementById('eiditor');
    modal.classList.toggle('md-show');
}



