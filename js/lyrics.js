
class LrcInfo {
    constructor(){
        // 当前编辑的行
        this.index = 0;
        // 鼠标按下的播放时间
        this.mouseStart = 0;
        // 歌词文本
        this.text = "";
    }
}

class ElrcInfo {
    constructor(index, indexTh){
        // 当前编辑的行
        this.index = index;
        // 当前编辑到当前行的第几个字
        this.indexTh = indexTh;
        // 鼠标按下的播放时间
        this.mouseStart = 0;
        // 鼠标抬起的播放时间
        this.mouseEnd = 0;
        // 上一个鼠标抬起的时间
        this.mousePre = 0;
        // 堆栈
        this.stack = [];
        // 歌词文本
        this.text = "";
    }
}

class ElrcElement {
    constructor(duration, text, delay, start=0, end=0) {
        this.duration = duration * 1000;
        this.text = text;
        this.delay = delay * 1000;
        // 这两个值用于新建歌词
        this.start = start;
        this.end = end;
    }
}

class ElrcItem {
    constructor(index, rows, timeStampStr, timeStamp, lyricsItem, lyricsItemTranslate){
        this.index = index;
        this.rows = rows;
        this.timeStampStr = timeStampStr
        this.timeStamp = timeStamp
        // lrc 模式的纯歌词文本
        this.lyricsItem = lyricsItem
        this.lyricsItemTranslate = lyricsItemTranslate
        this.ehanceLyricsItems = []
    }

    addItem(elrcElement){
        this.ehanceLyricsItems.push(elrcElement)
    }

    letters(){
        function getType(letter){
            // 正则表达式匹配中文字符、日文字符和韩文字符
            let chineseRegex = /[\u4e00-\u9fff]/;
            let englishRegex = /^[A-Za-z]$/;
            let japaneseRegex = /[\u3040-\u30ff]/; // 日文假名字符范围
            let koreanRegex = /[\uac00-\ud7af]/; // 韩文字符范围
            let punctuationRegex = /[\x21-\x2f\x3a-\x40\x5b-\x60\x7B-\x7F]/; // 示例标点符号
            let whitespaceRegex = /\s/; // 空白字符
            let typer = '?'
            if (chineseRegex.test(letter)){
                typer = 'cn'
            }else if (englishRegex.test(letter)){
                typer = 'en'
            }else if (japaneseRegex.test(letter)){
                typer = 'jp'
            }else if (koreanRegex.test(letter)){
                typer = 'kr'
            }else if (punctuationRegex.test(letter)){
                typer = 'pt'
            }else if (whitespaceRegex.test(letter)){
                typer = 'space'
            }
            return typer
        }

        let complexStr = this.lyricsItem.replace(/\s+/g, ' ');

        let separateds = complexStr.split(''); // 将字符串拆分为字符数组
        let lst = []; // 最终结果数组
        let item = ''; // 临时存储字符
        let stack = []; // 用于跟踪当前字符类型
        let typer = ''

        separateds.forEach(function(letter) {
            typer = getType(letter)
            if (['cn', 'jp', 'kr'].includes(typer)) {
                lst.push(item);
                item = letter
            }else if (['pt', 'space'].includes(typer)) {
                item += letter
            } else if (typer === 'en') {
                if (['en', 'pt'].includes(stack[stack.length - 1])) {
                item += letter
                }else{
                    lst.push(item);
                    item = letter
                }
            } else {
                item += letter;
            }
            stack.push(typer);
        });

        if (lst.length > 0) {
        lst.shift()
        }

        // 检查最后一个item是否需要添加
        if (item.length > 0) {
        lst.push(item);
        }

        return lst
    }


    participle(){
        this.letters().forEach(letter => {
            this.addItem(new ElrcElement(0, letter, 0))
        })
    }

}



class LrcHandler {
    constructor() {
        console.log("LrcHandler.constructor")
        this.doms = {
            audio: document.querySelector('audio'),
            ul: document.querySelector('.container ul'),
            ulelrc: document.querySelector('.elrc ul'),
            ullrc: document.querySelector('.lrc ul'),
            elrc: document.querySelector('.elrc'),
            lrc: document.querySelector('.lrc'),
            container: document.querySelector('.container')
        }
        this.bindEvents()
        this.lyricsEdit = true;
        this.lyricsFlag = 1;
        // audio 'play' EventListener不是立即播放而是有延迟，这个值会自动计算
        this.playDelayTime = null;

        // 为UISwitch添加change事件监听器
        document.querySelector('.uiswitch').addEventListener('change', this.lyricsSwitch.bind(this));
        // 当这个堆栈pop是存timerStack4Next出栈的值，即堆栈的元素只能其它函数重置栈，或者在入栈/出栈函数间调用，其它函数想操作栈只能对以下的值来做处理
        this.timerStack4NextLastElement = null;

        document.getElementById('section1').addEventListener('click', this.flagChange.bind(this, 1));
        document.getElementById('section2').addEventListener('click', this.flagChange.bind(this, 2));
        document.getElementById('section3').addEventListener('click', this.flagChange.bind(this, 3));
    }

    init(player, elrcStr, id, title, offset, filename){
        console.log(`init:`)

        if (this.timerStack4NextLastElement!==null) {
            console.log(`${this.timerStack4NextLastElement.id}.init:`)
        }

        this.filename = filename
        // 重新格式化增加lrc并修复其中错误
        this.elrc = new Array(); //{行号：[ElrcItem]}
        // 歌词的第一行所在的行
        this.firstLyricsIndex = 1;
        // 当前显示的歌词行
        this.lineIndex = 0;
        this.doms.ul.innerHTML = '';
        this.doms.ullrc.innerHTML = '';
        this.doms.ulelrc.innerHTML = '';
        elrcStr = this.unStar(elrcStr);

        let rs = this.processLyrics(elrcStr, 1);  // 原始歌词字符串
        this.elrcStr = rs.elrcStr
        this.doms.ul.appendChild(rs.frag);
        this.elrc = rs.elrc;
        this.firstLyricsIndex = rs.firstLyricsIndex;

        rs = this.processLyrics(this.elrcStr, 2);  // 逐行歌词
        this.lrcNew = rs.elrc;
        this.doms.ullrc.appendChild(rs.frag)

        rs = this.processLyrics(this.elrcStr, 3);  // 逐字歌词
        this.elrcNew = rs.elrc;
        this.doms.ulelrc.appendChild(rs.frag)

        this.elrcInfo = new ElrcInfo(0, 0)
        this.lrcInfo = new LrcInfo();
        this.doms = {
            audio: document.querySelector('audio'),
            ul: document.querySelector('.container ul'),
            ulelrc: document.querySelector('.elrc ul'),
            ullrc: document.querySelector('.lrc ul'),
            elrc: document.querySelector('.elrc'),
            lrc: document.querySelector('.lrc'),
            container: document.querySelector('.container')
        }
        $('.elrc').off('click');
        $('.lrc').off('click');
        $('.music-player__main').off('mousedown');
        $('.music-player__main').off('mouseup');

        $('.lrc').on('click', 'li', this.lyricsLineClick.bind(this));
        $('.elrc').on('click', 'li', this.elyricsLineClick.bind(this));
        $('.music-player__main').on('mousedown', this.lyricsTimerDown.bind(this));
        $('.music-player__main').on('mouseup', this.lyricsTimerUp.bind(this));


        this.rowsListCount = []
        let counter = 0
        this.timeStamps = []
        this.elrc.forEach(elrcItem => {
            counter += elrcItem.rows
            this.rowsListCount.push(counter)
            this.timeStamps.push(elrcItem.timeStamp)
        })
        if (!this.isSorted(this.timeStamps)) alert("歌词错误：未按时间增量排序")

        this.id = id;
        this.title = title;
        this.initEiditor(title, this.elrcStr);
        this.player = player
        this.offset = offset;
        this.offsetBack = offset;

        // 容器高度
        this.containerHeight = this.doms.container.clientHeight;
        // 每个li的高度
        this.liHeight = this.doms.ul.children[0].clientHeight;
        // 计时器id
        this.timers = [];
        this.initStack();
    }

    flagChange(flag){
        this.lyricsFlag = flag;
        if (this.lyricsFlag === 1) {
            this.initEiditor(this.title, this.elrcStr)
        }else if (this.lyricsFlag === 2) {
            this.initEiditor(this.title, this.lrcInfo.text)
        }else if (this.lyricsFlag === 3) {
            this.initEiditor(this.title, this.elrcInfo.text)
        }
    }

    initStack(){
        // 下行运行定时器ID堆栈，默认有个值是因为最开始是调用pop，需要有一个值
        this.timerStack4Next = [{id: null, seconds: null}]
    }

    isSorted(lst) {
        for (let i = 1; i < lst.length; i++) {
            if (lst[i - 1] > lst[i]) {
                console.log(lst[i - 1], lst[i], i)
                return false;
            }
        }
        return true;
    }

    unStar(str) {
        // Combined regular expression with all patterns
        const pattern = /(D\*\*n|d\*\*n|f\*\*k|F\*\*k|a\*s|a\*\*|A\*\*|n\*\*\*a|sh\*t|s\*\*t|S\*\*t|w\*\*d|d\*\*e|b\*\*ch|b\*\*\*h|h\*es|S\*x|s\*x|e\*\*\*\*\*y|d\*\*gs)/g;
        const replacements = {
            'D**n': 'Damn',
            'd**n': 'damn',
            'f**k': 'fuck',
            'F**k': 'Fuck',
            'a*s': 'ass',
            'a**': 'ass',
            'A**': 'Ass',
            'n***a': 'nigga',
            'sh*t': 'shit',
            's**t': 'shit',
            'S**t': 'Shit',
            'w**d': 'weed',
            'd**e': 'dope',
            'b**ch': 'bitch',
            'b***h': 'bitch',
            'h*es': 'hoes',
            'S*x': 'Sex',
            's*x': 'sex',
            'e*****y': 'ecstasy',
            'd**gs': 'drags'
        };

        const new_str = str.replace(pattern, matched => replacements[matched]);

        function countAsterisks(str) {
            // 使用正则表达式匹配所有星号(*)，并使用全局搜索标志(g)
            const matches = str.match(/(\*)/g);
            // 如果有匹配，返回数组的长度；否则返回0
            return matches ? matches.length : 0;
        }
        let countStar = countAsterisks(new_str)
        if (countStar != 0) {
            alert(`检测到${countStar}个*`)
        }
        return new_str
    }

    timeToSeconds(time) {
        const [minutes, seconds] = time.split(':').map(parseFloat);
        return minutes * 60 + seconds;
    }
    
    secondsToTime(seconds){
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');

        // 使用 padStart 确保始终有两位或三位的零
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedSeconds = remainingSeconds.toString().padStart(2, '0');

        // 拼接最终的字符串格式
        return `${formattedMinutes}:${formattedSeconds}.${milliseconds}`;
    }


    // QQ增强歌词格式有问题，结尾可能有连续的多个时间标签，并且它们的时候可能比下行的开始时间还慢，所以这里要格式化一下
    processLyrics(lyrics, lyricsFlag=1) {
        // 按行分割歌词
        const lines = lyrics.split('\n');
        let formatedLines = [];
        let steps = 1
        let elrc = []
        let firstLyricsIndex = 1

        function detectStep(lines, index){
            let steps = 0;
            let match = lines[index].match(/^\[(\d{2}:\d{2}\.\d{2,3})\]/)
            if (match === null) {
                return {"steps":steps, "timestamp":""}
            }
            let timestamp = match[1]
            while(lines[index].startsWith(match[0])){
                steps ++                    
                if (index + 1 < lines.length){
                    index ++
                }else{
                    break
                }
            }

            return {"steps":steps, "timestamp":timestamp}
        }

        var detect = null
        const frag = document.createDocumentFragment();
        var counter = 0
        for (let i = 0; i < lines.length; i+=steps) {
            var line = lines[i].trim();
            detect = detectStep(lines, i)
            steps = detect.steps
            if (steps == 0) {
                steps = 1
                formatedLines.push(line);
                continue
            }
            var elrcItem = new ElrcItem(counter, steps, detect.timestamp, 
                this.timeToSeconds(detect.timestamp), 
                line.replace(/<\d{2}:\d{2}\.\d{2,3}>/g, '').replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, ''), 
                null)

            if (steps == 2) {
                elrcItem.lyricsItemTranslate = lines[i+1].trim().replace(/<\d{2}:\d{2}\.\d{2,3}>/g, '').replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '')
            }
            if (elrcItem.lyricsItem.indexOf("：")!=-1 || elrcItem.lyricsItem.indexOf(":")!=-1) {
                if (counter == firstLyricsIndex) {
                    firstLyricsIndex = counter + 1
                }
            }else if (steps == 2) {
                if (elrcItem.lyricsItemTranslate.indexOf("：")!=-1 || elrcItem.lyricsItemTranslate.indexOf(":")!=-1) {
                    if (counter == firstLyricsIndex) {
                        firstLyricsIndex = counter + 1
                    }
                }
            }

            counter ++;
            if (steps > 2) {
                alert(`错误格式：显示行数 > 2!`)
                continue
            }

            // 新建lrc li
            const createElrcLrcElement = (elrcItem) => {
                const li = document.createElement('li');
                li.setAttribute('data-group', elrcItem.index);

                if (elrcItem.lyricsItem.match(/\d{3,},\d+\)/)) {
                    // <00:26.315><00:26.418>26315,103)
                    alert(`垃圾歌词信息![${elrcItem.timeStampStr}]${elrcItem.lyricsItem}`)
                }else if(elrcItem.lyricsItem.match(/\(\d{3,},\d+/)){
                    // (39509,295
                    alert(`垃圾歌词信息![${elrcItem.timeStampStr}]${elrcItem.lyricsItem}`)
                }

                if (lyricsFlag === 2) {
                    const fragment = document.createDocumentFragment();
                    const bElement = document.createElement('b');
                    bElement.textContent = elrcItem.timeStampStr;
                    fragment.appendChild(bElement);

                    const spanElement = document.createElement('span');
                    spanElement.textContent = elrcItem.lyricsItem;
                    fragment.appendChild(spanElement);
                    li.appendChild(fragment);
                }else if (elrcItem.ehanceLyricsItems.length == 0) {
                    li.textContent = elrcItem.lyricsItem
                }else{
                    const fragment = document.createDocumentFragment();
                    if (lyricsFlag === 3) {
                        const bElement = document.createElement('b');
                        bElement.textContent = elrcItem.timeStampStr;
                        fragment.appendChild(bElement);
                    }
                    elrcItem.ehanceLyricsItems.forEach(ehanceLyricsItem => {
                        const spanElement = document.createElement('span');
                        spanElement.textContent = ehanceLyricsItem.text;
                        fragment.appendChild(spanElement);
                    })
                    li.appendChild(fragment);
                }
                if (elrcItem.lyricsItemTranslate !== null) {
                    const liTranslate = document.createElement('li');
                    if (lyricsFlag === 2){
                        const fragment = document.createDocumentFragment();
                        const bElement = document.createElement('b');
                        bElement.textContent = "";
                        fragment.appendChild(bElement);

                        const spanElement = document.createElement('span');
                        spanElement.textContent = elrcItem.lyricsItemTranslate;
                        fragment.appendChild(spanElement);
                        liTranslate.appendChild(fragment);
                        liTranslate.setAttribute('data-group', elrcItem.index);
                    }else{
                        liTranslate.setAttribute('data-group', elrcItem.index);
                        liTranslate.textContent = elrcItem.lyricsItemTranslate
                        if (elrcItem.lyricsItemTranslate.match(/\d+\)/)) {
                            alert(`垃圾歌词信息![${elrcItem.timeStampStr}]${elrcItem.lyricsItem}`)
                        }
                    }
                    return [li, liTranslate]                        
                }else{
                    return [li]
                }
            }

            if (!line.match(/<(\d{2}:\d{2}\.\d{2,3})>/)) {
                // lrc歌词解析
                if (lyricsFlag === 3) {
                    elrcItem.participle()
                }
                elrc.push(elrcItem)

                createElrcLrcElement(elrcItem).forEach(li => {
                    frag.appendChild(li)
                })
                // toast(`非增强歌词格式：${line}`, "orange")
                formatedLines.push(line);
                if (steps === 2) {
                    formatedLines.push(`[${elrcItem.timeStampStr}]${elrcItem.lyricsItemTranslate}`)
                }
                continue
            }

            var nextTimeStr = '';
            // 查找下一组的时间戳
            if (i + steps < lines.length) {
                let nextLine = lines[i + steps];
                const nextTimeMatch = nextLine.match(/^\[(\d{2}:\d{2}\.\d{2,3})\]/);
                if (nextTimeMatch) {
                    nextTimeStr = nextTimeMatch[1];
                }else{
                    toast(`错误格式：${nextLine}`, "orange")
                    continue
                }
            }else{
                // 最后一行获取下组时间戳，即最后一个<timestamp>
                let tmpMatch = lines.slice(i, i+steps).join("\n").match(/<(\d{2}:\d{2}\.\d{2,3})>[^<>]*$/)
                if (tmpMatch) {
                    nextTimeStr = tmpMatch[1]
                }else{
                    toast(`无法解析：${line}`, "orange")
                    continue
                }
            }


            // 找最小的时间戳
            const findMinTimestamp = (line, nextTimeStr) => {
                var nextTime = this.timeToSeconds(nextTimeStr);
                var lastTimeStr = null
                var timeMatch = line.match(/<(\d{2}:\d{2}\.\d{2,3})>$/);
                while(timeMatch) {
                    lastTimeStr = timeMatch[1];
                    const lastTime = this.timeToSeconds(lastTimeStr);

                    if (lastTime > nextTime) {
                        
                        lastTimeStr = nextTimeStr
                    }
                    line = line.replace(/<\d{2}:\d{2}\.\d{2,3}>$/, '');
                    timeMatch = line.match(/<(\d{2}:\d{2}\.\d{2,3})>$/);
                }
                return `<${lastTimeStr}>`
            }
            // 替换最后的最小时间戳
            var lastTimeStr = findMinTimestamp(line, nextTimeStr)
            line = line.replace(/(<\d{2}:\d{2}\.\d{2,3}>)*$/, '') + lastTimeStr
            formatedLines.push(line);
            if (steps == 2) {
                formatedLines.push(`[${elrcItem.timeStampStr}]${elrcItem.lyricsItemTranslate}`);
            }

            // 新建ElrcElement，li元素
            const addElrcElement = (elrcItem, elrcLine) => {
                const timeRegex = /^\[(\d{2}:\d{2}\.\d{2,3})\]<(\d{2}:\d{2}\.\d{2,3})>/;
                const match_line = timeRegex.exec(elrcLine);
                if (match_line) {
                    let startTime = match_line[2]
                    const timeStampSeconds = elrcItem.timeStamp
                    const line_content = elrcLine.slice(match_line[0].length);

                    const regex = /([^<>]*)<(\d{2}:\d{2}\.\d{2,3})>/g;
                    let text, endTime;
                    var match;
                    while (match = regex.exec(line_content)) {
                        text = match[1];
                        endTime = match[2];

                        // Convert start and end times to seconds if needed
                        const startTimeInSeconds = this.timeToSeconds(startTime);
                        const endTimeInSeconds = this.timeToSeconds(endTime);
                        const durationInSeconds = (endTimeInSeconds - startTimeInSeconds).toFixed(3);
                        // console.log(startTimeInSeconds, endTimeInSeconds, durationInSeconds)
                        elrcItem.addItem(new ElrcElement(Number(durationInSeconds), 
                            text, 
                            Number((startTimeInSeconds - timeStampSeconds).toFixed(3))),
                            startTimeInSeconds,
                            endTimeInSeconds)

                        startTime = endTime
                    }
                }
                return elrcItem
            }

            elrcItem = addElrcElement(elrcItem, line)
            createElrcLrcElement(elrcItem).forEach(li => {
                frag.appendChild(li)
            })
            elrc.push(elrcItem)
        }

        if (lines.length !== formatedLines.length) {
            alert("格式化歌词出错！行数不匹配")
        }
        // 返回处理后的歌词
        return {"elrcStr":formatedLines.join('\n'), "frag":frag, "elrc":elrc, "firstLyricsIndex":firstLyricsIndex};
    }

    // 设置编辑标题
    initEiditor(title, lyrics) {
        var header = document.querySelector('.md-modal .md-content h3');
        if (header) {
          header.textContent = title;
        }
        var textarea = document.getElementById('editor-area');
        if (textarea) {
            textarea.value = lyrics;
        }
    }

    // 应用编辑
    apply() {
        var textarea = document.getElementById('editor-area');
        var regex = /\[(\d{2}:\d{2}\.\d{2,3})\]/;
        let lst = [];
        textarea.value.split("\n").forEach((line, index) => {
            line = line.trim();
            if (regex.test(line)) {
                lst.push(`${line}`)
            }else{
                lst.push(`[00:00.${String(index).padStart(3, '0')}]${line}`)
            }
        })
        let elrcStr = lst.join("\n");
        this.init(this.player, elrcStr, this.id, this.title, this.offsetBack)
        this.loadedmetadata()
        toggleModal();
    }


    lyricsSwitch(){
        // event.target是触发事件的元素，即checkbox
        var isChecked = event.target.checked; // 获取checkbox的选中状态

        // 根据checkbox的选中状态执行一些操作
        if (isChecked) {
            this.lyricsEdit = true;
            console.log('偏移调整开关已打开', this.lyricsEdit);
        } else {
            this.lyricsEdit = false;
            console.log('偏移调整开关已关闭', this.lyricsEdit);
        }
    }

    getCurrentTimeOfLyrics(){
        if (this.offset != 404){
            return this.doms.audio.currentTime + this.offset
        }else{
            return this.doms.audio.currentTime
        }
    }

    // 二分查找currentTime对应的已排序的时间戳中的行数
    findLineIndex(lstSorted, currentTime) {
        if (currentTime < lstSorted[1]) return 0;
        let left = 0;
        let right = lstSorted.length - 1;
        let result = null;

        while (left <= right) {
            let mid = Math.floor((left + right) / 2);

            if (lstSorted[mid] <= currentTime) {
                result = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return result;
    }

    animateSpan(span, duration, starter, abortController) {
        const start = performance.now();
        let signal = abortController.signal

        function animate(time) {
            if (signal.aborted) {
                console.log("\tAnimation aborted");
                // span.removeAttribute("style")
                return;
            }

            if (!this.doms.audio.paused){
                const elapsed = starter + time - start;
                const progress = Math.min(elapsed / duration, 1);

                span.style.backgroundPosition = `${200 - progress * 100}% 0`;

                if (progress < 1) {
                    requestAnimationFrame(animate.bind(this));
                }
            }
        }

        requestAnimationFrame(animate.bind(this));
    }

    animateElrcResume(spanlist = []) {
        var spans;
        if (spanlist.length === 0){
            spans = this.doms.ul.querySelectorAll("li.active span");
        }else{
            spans = spanlist
        }
        const offset = (this.getCurrentTimeOfLyrics() - this.elrc[this.lineIndex].timeStamp).toFixed(3) * 1000
        let abortController = new AbortController();
        const fullStyles = [];
        this.timers = []

        let tmp = ""
        for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            var elrcElement = this.elrc[this.lineIndex].ehanceLyricsItems[i]
            const duration = elrcElement.duration;
            const delay = elrcElement.delay;
            tmp = tmp + elrcElement.text

            // 完全变色
            if (delay+duration <= offset){
                // 计算新样式，但不直接应用
                fullStyles.push({
                    el: span,
                    backgroundPosition: '100% 0' // 这里应该是实际的样式值
                });
                tmp = tmp + "A.100"
            }else if (delay <= offset && offset < delay+duration){
                // 循环结束后，一次性应用所有样式更改
                fullStyles.forEach(({ el, backgroundPosition }) => {
                    el.style.backgroundPosition = backgroundPosition;
                });
                this.animateSpan(span, duration, offset-delay, abortController)
                tmp = tmp + `B.${(offset-delay)/duration}`
            }else{
                // 待变色
                let timeoutId = setTimeout(() => {
                    this.animateSpan(span, duration, 0, abortController);
                }, delay-offset);
                tmp = tmp + `C:${delay-offset}ms`
                this.timers.push({ id: timeoutId, controller: abortController })
            }
        }


        if (this.lineIndex + 1 < this.elrc.length) {
            // 这是下一行的定时运行，所以一旦播放暂停或跳转或调整歌词偏移，下行的timerouId是一定能拿到的（用于clearTimer防止继续运行）
            let baseLineTime = this.elrc[this.lineIndex+1].timeStamp
            let nextLineTime = parseFloat((baseLineTime - this.getCurrentTimeOfLyrics()).toFixed(3)) * 1000
            let timeoutId = setTimeout(() => {
                this.setOffset();
            }, nextLineTime+10); //这里+1是因为计算有误差+1ms，要有一个提前量+9ms(否则如果在结尾附近可能导致重复的双轮变色)
            this.timerStack4NextLastElement = {id: timeoutId, seconds: baseLineTime}
            this.timerStack4Next.push(this.timerStack4NextLastElement)
            console.log(`${timeoutId}.CreateTimer.${nextLineTime/1000}=${baseLineTime}-${this.getCurrentTimeOfLyrics()}: ${tmp}`)
        }else{
            console.log(`CreateTimer: ${tmp}`)
        }
    }

    clearTimer(){
        if (this.timerStack4NextLastElement && this.timerStack4NextLastElement.id) {
            console.log(`${this.timerStack4NextLastElement.id}.Clear Timer`)
            clearTimeout(this.timerStack4NextLastElement.id)
        }else{
            console.log(`Noid.Clear Timer`)
        }

        if (this.timers.length === 0)
            return
        // 中止相关的AbortController, 一组内的计时器用的AbortController都是一个，所以直接取一个停止就可以
        this.timers[0].controller.abort()
        // 逆序遍历取消定时，防止因为时间差一直无法追赶而无法取消定时
        this.timers.forEach((time, index) => {
            let timer = this.timers[this.timers.length - 1 - index]
            clearTimeout(timer.id) // 清除setTimeout
        });
        this.timers = []; // 清空定时器数组
    }

    setOffset(){
        if (this.doms.audio.paused) {
            console.log("播放暂停：停止继续歌词变色")
            return
        }
        this.lineIndex = this.findLineIndex(this.timeStamps, this.getCurrentTimeOfLyrics());
        let timerStackItem = this.timerStack4Next.pop()
        if (this.timerStack4Next.length > 0) {
            alert("错误！堆栈失衡！")
        }
        console.log("\t", this.timerStack4Next.length, this.lineIndex, timerStackItem.id, this.getCurrentTimeOfLyrics())
        if (timerStackItem.id !== null && timerStackItem.seconds !== 0.0001234567) {
            if (timerStackItem.seconds+0.002 > this.getCurrentTimeOfLyrics()) {
                // 运行到这说明定时器由于播放器的时间误差，没有运行在下一行的开头，而是运行到了变色行的末尾，所以需要再次启动定时，回调自身
                let ms = timerStackItem.seconds+0.010 - this.getCurrentTimeOfLyrics()
                ms = parseInt(ms.toFixed(3) * 1000)
                let timeoutId = setTimeout(() => {
                    this.setOffset()
                }, ms);
                console.log(`${timerStackItem.id}->${timeoutId}.setOffset: Play time deviation, reset timer running after ${ms}ms`)
                this.timerStack4NextLastElement = {id: timeoutId, seconds: 0.0001234567}
                this.timerStack4Next.push(this.timerStack4NextLastElement)
                return
            }
        }

        const offset = -(this.rowsListCount[this.lineIndex] * this.liHeight - this.containerHeight / 3) + this.liHeight / 3;
        this.doms.ul.style.transform = `translateY(${offset}px)`;

        // 当前清理样式的时候，可能当前字的变色还在进行，导致active下行时，上行还会被重新变色，所以要停止之前的变色
        this.clearTimer()
        // 去掉之前的active样式
        var lis = this.doms.ul.querySelectorAll('.active')
        lis.forEach(li => {
            if (li.dataset.group != this.lineIndex){
                const spans = li.querySelectorAll('span')
                spans.forEach(span => {span.removeAttribute("style");})
                li.removeAttribute('class')
            }
        })

        lis = this.doms.ul.querySelectorAll('li[data-group="'+this.lineIndex+'"]');
        for (let i = 0; i < lis.length; i++) {
            let li = lis[i];
            if(li){
                li.classList.add('active');
                if (i === 0) {
                    this.animateElrcResume(li.querySelectorAll('span'))
                }
            }
        }
    }

    pause(event){
        if (this.lyricsFlag === 1) {
            console.log("pause:")
            this.clearTimer()            
        }
    }

    play(execStart = null, audioStart = null){
        if (execStart !== null && audioStart !== null) {
            let executionTime = Date.now() - execStart;
            let audioTime = (this.doms.audio.currentTime - audioStart)*1000;
            this.playDelayTime = Math.ceil((executionTime - audioTime)*1.6)
            console.log(`calculated the play delay time: ${this.playDelayTime}ms`)
        }
        this.initStack();
        this.setOffset()
    }

    playWrapper(event){
        if (this.lyricsFlag === 1) {
            // playWrapper一般在本类init前运行，所以会有比较大的延迟
            console.log("playWrapper:")
            this.clearTimer()
            let audioStart = this.doms.audio.currentTime;
            let execStart = Date.now()
            let timeoutId = null
            // delay加载准备播放时间，即这行代码开始delay毫秒内你开始听到声音
            // 首次加载delay时间较久，并且不同歌曲都不相同，这里统一设置默认值为400毫秒，不是古董机这个初始值应该够了
            if (audioStart === 0) {
                console.log("use default play delay time: 400ms")
                timeoutId = setTimeout(() => {
                    this.play();
                }, 400);
            }else{
                if (this.playDelayTime !== null){
                    timeoutId = setTimeout(() => {
                        this.play();
                    }, this.playDelayTime );
                }else{
                    // 未设置则用300毫秒的延迟再计算
                    console.log("use default play delay time: 400ms")
                    timeoutId = setTimeout(() => {
                        this.play(execStart, audioStart);
                    }, 400 );
                }
            }
            this.timerStack4NextLastElement = {id: timeoutId, seconds: null}
            console.log(`${timeoutId}:CreateTimer.Play`)
        }else if(this.lyricsFlag === 3){
            this.doms.elrc.scrollTop = this.rowsListCount[this.elrcInfo.index] * this.liHeight - this.containerHeight / 3;
        }
    }

    seeked(){
        if (!this.doms.audio.paused) {
            console.log("seeked:", this.doms.audio.paused, this.timerStack4NextLastElement === null ? this.timerStack4NextLastElement:this.timerStack4NextLastElement.id)
            this.initStack();
            this.setOffset();
        }
    }

    lyricsLineClick(event){
        let targetElement = $(event.target);
        let parentElement = targetElement.closest('li')[0];
        let tagName = parentElement.tagName.toLowerCase();


        if (tagName === 'li') {
            let bText = $(parentElement).find('b').text();
            let timeStamp = this.timeToSeconds(bText)

            let index = $(parentElement).data('group');
            this.lrcInfo.index = index;

            // 跳转提前1.5s
            if (!isNaN(timeStamp)) {
                this.doms.audio.currentTime = timeStamp - 1.5
            }else{
                toast("未获取到时间")
            }
            this.doms.lrc.scrollTop = this.rowsListCount[this.lrcInfo.index] * this.liHeight - this.containerHeight / 3;
        }else{
            toast("点击空白区域设置起始时间")
        }
    }

    elyricsLineClick(event){
        if (this.lyricsFlag !== 3) {
            return;
        }
        let targetElement = $(event.target);
        let tagName = event.target.tagName.toLowerCase();

        if (tagName === 'li') {
            let bText = targetElement.find('b').text();
            console.log(bText);
            let timeStamp = this.timeToSeconds(bText)

            let index = this.findLineIndex(this.timeStamps, timeStamp);
            this.elrcInfo.index = index;
            this.elrcInfo.indexTh = 0;
            this.elrcInfo.mousePre = 0;

            // 跳转提前1.5s
            if (!isNaN(timeStamp)) {
                this.doms.audio.currentTime = timeStamp - 1.5
            }else{
                toast("未获取到时间")
            }
            this.doms.elrc.scrollTop = this.rowsListCount[this.elrcInfo.index] * this.liHeight - this.containerHeight / 3;
        }else{
            toast("点击空白区域设置起始时间")
        }
    }

    lyricsTimerUp(event){
        if (this.lyricsFlag !== 3) {
            return;
        }
        this.elrcInfo.mouseEnd = this.doms.audio.currentTime;
        console.log("up.")
        let data = this.elrcInfo.stack.pop();
        let itemElrc = this.elrcNew[this.elrcInfo.index]
        if (data === undefined) {
            return
        }

        let elementSpan = data.elementSpan;
        let dataElrc = data.dataElrc;
        if (this.elrcInfo.indexTh+1 === itemElrc.ehanceLyricsItems.length) {
            this.elrcNew[this.elrcInfo.index].ehanceLyricsItems[this.elrcInfo.indexTh].end = this.elrcInfo.mouseEnd.toFixed(3);
            // this.doms.elrc.scrollTop += this.elrcNew[this.elrcInfo.index].rows*this.liHeight;
            this.doms.elrc.scrollTop = this.rowsListCount[this.elrcInfo.index] * this.liHeight - this.containerHeight / 3;
            this.elrcInfo.index += 1;
            this.elrcInfo.indexTh = 0;
            this.elrcInfo.mousePre = 0;
            if (this.elrcInfo.index< this.elrcNew.length) {
                console.log(this.elrcNew[this.elrcInfo.index].ehanceLyricsItems[this.elrcInfo.indexTh])
            }else{
                this.lyricsGenerate();
                this.initEiditor(this.title, this.elrcInfo.text);
                toast("歌词已完成！")
            }
        }else{
            this.elrcInfo.indexTh += 1;
            this.elrcInfo.mousePre = this.elrcInfo.mouseEnd
        }
        if (elementSpan) {
            elementSpan.style.background = '';
            elementSpan.style.color = '#adf27f';
            elementSpan.style.textShadow = '0 0 10px rgb(255 255 255 / 87%)'
        }
        console.log(dataElrc)
        console.log(elementSpan)
    }

    lyricsTimerDown(event){
        if (this.lyricsFlag === 3) {
            this.elrcInfo.mouseStart = this.doms.audio.currentTime.toFixed(3);
            let startTime = 0;
            let endTime = 0;
            if (this.elrcInfo.index < this.elrcNew.length) {
                if (this.elrcNew[this.elrcInfo.index].ehanceLyricsItems.length == 0) {
                    // this.doms.elrc.scrollTop += this.elrcNew[this.elrcInfo.index].rows*this.liHeight;
                    this.doms.elrc.scrollTop = this.rowsListCount[this.elrcInfo.index] * this.liHeight - this.containerHeight / 3;
                    this.elrcInfo.index += 1;
                    this.elrcInfo.indexTh = 0;
                    this.elrcInfo.mousePre = 0;
                    if (this.elrcInfo.index >= this.elrcNew.length) {
                        this.lyricsGenerate();
                        this.initEiditor(this.title, this.elrcInfo.text);
                        toast("歌词已完成！")
                    }
                    return;
                }
                if (this.elrcInfo.mousePre === 0) {
                    startTime = this.elrcInfo.mouseStart
                    this.elrcNew[this.elrcInfo.index].timeStampStr = this.secondsToTime(startTime);
                }else{
                    startTime = this.elrcInfo.mouseStart - (this.elrcInfo.mouseStart - this.elrcInfo.mousePre)/2;
                    endTime = this.elrcInfo.mousePre + (this.elrcInfo.mouseStart - this.elrcInfo.mousePre)/2;
                    this.elrcNew[this.elrcInfo.index].ehanceLyricsItems[this.elrcInfo.indexTh-1].end = endTime.toFixed(3);
                    console.log(this.elrcNew[this.elrcInfo.index].ehanceLyricsItems[this.elrcInfo.indexTh-1])
                }
                this.elrcNew[this.elrcInfo.index].ehanceLyricsItems[this.elrcInfo.indexTh].start = startTime;

                let itemElrc = this.elrcNew[this.elrcInfo.index]
                // nth-child从1开始, this.rowsListCount也是从1开始所以这里直接使用
                // -itemElrc.rows+1要获取到上行结束再向下获取一行，防止获取到翻译行
                let elementLi = this.doms.ulelrc.querySelector(`li:nth-child(${this.rowsListCount[this.elrcInfo.index]-itemElrc.rows+1})`);
                // nth-child从1开始, <span>前有个<b>，所以这里+2
                let elementSpan = elementLi.querySelector(`span:nth-child(${this.elrcInfo.indexTh+2})`)
                let dataElrc = itemElrc.ehanceLyricsItems[this.elrcInfo.indexTh];
                this.elrcInfo.stack.push({"elementSpan":elementSpan, "dataElrc":dataElrc})
                if (elementSpan) {
                    elementSpan.style.background = '#adf27f';
                }
            }
        }else if (this.lyricsFlag === 2) {
            this.lrcInfo.mouseStart = this.doms.audio.currentTime.toFixed(3);
            let steps = 1;
            // 右键一次双行
            if (event.button === 2) {
                steps = 2
            }
            for (let i = 0; i < steps; i++) {
                if (this.lrcInfo.index < this.lrcNew.length) {
                    let timeStr = this.secondsToTime(this.lrcInfo.mouseStart);
                    this.lrcNew[this.lrcInfo.index].timeStampStr = timeStr;
                    this.lrcNew[this.lrcInfo.index].timeStamp = this.lrcInfo.mouseStart;

                    let itemLrc = this.lrcNew[this.lrcInfo.index]
                    let elementLi = this.doms.ullrc.querySelector(`li:nth-child(${this.rowsListCount[this.lrcInfo.index]-itemLrc.rows+1})`);
                    // nth-child从1开始, <span>前有个<b>，所以这里是2
                    let elementB = elementLi.querySelector(`b:nth-child(1)`)
                    let elementSpan = elementLi.querySelector(`span:nth-child(2)`)
                    if (elementB) {
                        elementB.textContent = timeStr;
                        elementB.style.color = '#7fd0f2';
                    }
                    if (elementSpan) {
                        elementSpan.style.color = '#adf27f';
                        elementSpan.style.textShadow = '0 0 10px rgb(255 255 255 / 87%)'
                    }
                    this.doms.lrc.scrollTop = this.rowsListCount[this.lrcInfo.index] * this.liHeight - this.containerHeight / 3;
                    this.lrcInfo.index += 1;
                }else{
                    this.lyricsGenerate();
                    this.initEiditor(this.title, this.lrcInfo.text);
                    toast("歌词已完成！")
                }
            }
        }
    }

    lyricsGenerate(){
        let lst = [];
        if (this.lyricsFlag === 3) {
            this.elrcNew.forEach((elrcs, index) => {
                let header = `[${elrcs.timeStampStr}]`;
                let line = "";
                let pre = ""
                elrcs.ehanceLyricsItems.forEach((elrc, idx) => {
                    if (line.length === 0) {
                        line = `<${this.secondsToTime(elrc.start)}>${elrc.text}<${this.secondsToTime(elrc.end)}>`
                    }else{
                        line += `${elrc.text}<${pre}>`
                    }
                    pre = this.secondsToTime(elrc.end);
                })
                lst.push(header + line)
                if (elrcs.lyricsItemTranslate !== null) {
                    lst.push(`[${elrcs.timeStampStr}]${elrcs.lyricsItemTranslate}`)
                }
            })
            this.elrcInfo.text = lst.join("\n");
        }else if (this.lyricsFlag === 2){
            this.lrcNew.forEach((lrcs, index) => {
                lst.push(`[${lrcs.timeStampStr}]${lrcs.lyricsItem}`);
                if (lrcs.lyricsItemTranslate !== null) {
                    lst.push(`[${lrcs.timeStampStr}]${lrcs.lyricsItemTranslate}`)
                }
            })
            this.lrcInfo.text = lst.join("\n");
        }
    }

    seekedWrapper(event){
        if (this.lyricsFlag === 1) {
            console.log("seekedWrapper:", this.timerStack4NextLastElement)
            // seeked可能会运行在Play之前：即loadedmetadata中自动跳转到一个位置，用户点击播放后，playWrapper,seekedWrapper先后顺序是不一定的
            if (this.timerStack4NextLastElement !== null){
                // 这里要检测是否已经有play的timeroutId在，否则双重定时运行会导致歌词变色重影
                if (this.timerStack4NextLastElement.id !== null 
                    && this.timerStack4NextLastElement.seconds === null) {
                    console.log("\tdetect Play has timeroutId, return")
                    return
                }else{
                    // 这里要检测是否已经有play的timeroutId调用生成的新的timeroutId在,并且与当前要设置的相同
                    this.lineIndex = this.findLineIndex(this.timeStamps, this.getCurrentTimeOfLyrics());
                    console.log(`seekedWrapper.${this.timeStamps[this.lineIndex+1]}`)
                    if (this.timerStack4NextLastElement.seconds == this.timeStamps[this.lineIndex+1]) {
                        console.log("\tdetected The Same Timer Has Been Running, return")
                        return
                    }
                }
            }

            this.clearTimer()
            let timeoutId = setTimeout(() => {
                this.seeked();
            }, this.playDelayTime);
            console.log(`${timeoutId}.CreateTimer.Seeked`)            
        }
    }

    loadedmetadata(){
        console.log("loadedmetadata:")
        // 如果处理编辑偏移模式
        if (this.lyricsEdit) {
            var audio = document.querySelector('.music-player__audio');
            // 获取第一名歌词的开始时间
            var startTime = this.elrc[this.firstLyricsIndex].timeStamp
            audio.currentTime = startTime
        }
    }

    bindEvents(){
        // https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/audio
        document.querySelector('.md-apply').addEventListener('click', this.apply.bind(this));
        this.doms.audio.addEventListener('loadedmetadata', this.loadedmetadata.bind(this))
        this.doms.audio.addEventListener('pause', this.pause.bind(this))
        this.doms.audio.addEventListener('play', this.playWrapper.bind(this))
        this.doms.audio.addEventListener('seeked', this.seekedWrapper.bind(this))
        // 废弃！timeupdate 更新频率慢，会导致歌词的首字无颜色变化过程，已修改为setTimeout方式调用下一行的显示
        // this.doms.audio.addEventListener('timeupdate', this.setOffsetWrapper.bind(this))
        window.addEventListener('keydown', this.offsetLyrics.bind(this));
    }

    unbindEvents() {
        this.clearTimer()
        document.querySelector('.md-apply').removeEventListener('click', this.apply.bind(this));
        this.doms.audio.removeEventListener('loadedmetadata', this.loadedmetadata.bind(this))
        this.doms.audio.removeEventListener('pause', this.pause.bind(this))
        this.doms.audio.removeEventListener('play', this.playWrapper.bind(this))
        this.doms.audio.removeEventListener('seeked', this.seekedWrapper.bind(this))
        window.removeEventListener('keydown', this.offsetLyrics.bind(this));
    }


    offsetLyrics(event){
        let debounceTimer;
        const DEBOUNCE_DELAY = 100; // 防抖延迟时间（毫秒）
        debounceTimer = setTimeout(() => {
            var modal = document.querySelector('.md-modal');
            if (modal) {
                var computedStyle = window.getComputedStyle(modal);
                var visibility = computedStyle.visibility;
                if (visibility === "visible"){
                    return
                }
            }

            const keyFunction = () => {
                this.offset = Number(this.offset.toFixed(3))
                toast(this.offset < 0 ? this.offset : `+${this.offset}`, this.offset>0?"lime":"#40E0D0");
                console.log(`offsetChanged to ${this.offset}`)
                this.clearTimer()
                this.initStack();
                this.setOffset();
            }

            // event.key 可以告诉我们哪个键被按下
            // 键盘事件的 keyCode 属性在一些旧的浏览器中使用，但已废弃
            switch (event.key) {
                case 'ArrowLeft':
                    if (this.lyricsFlag === 1){
                        this.offset -= 0.1
                        keyFunction()
                    }else if(this.lyricsFlag === 2 || this.lyricsFlag === 3){
                        let step = 0;
                        if (this.lyricsFlag === 2) {
                            step = 5;
                        }else{
                            step = 1;
                        }
                        this.doms.audio.currentTime -= step;
                    }
                    break;
                case 'ArrowUp':
                    this.player.changeSong("prev");
                    break;
                case 'ArrowRight':
                    if (this.lyricsFlag === 1){
                        this.offset += 0.1
                        keyFunction()
                    }else if(this.lyricsFlag === 2 || this.lyricsFlag === 3){
                        let step = 0;
                        if (this.lyricsFlag === 2) {
                            step = 5;
                        }else{
                            step = 1;
                        }
                        this.doms.audio.currentTime += step;
                    }
                    break;
                case 'ArrowDown':
                    this.player.changeSong("next");
                    break;
                case 'x':
                case 'X':
                    if (this.lyricsFlag === 1) {
                        this.offset = 404;
                        this.player.changeSong("next");                        
                    }else if (this.lyricsFlag === 2){
                        if (this.lrcInfo.index < this.lrcNew.length) {
                            // nth-child从1开始
                            let elementLi = this.doms.ullrc.querySelector(`li:nth-child(${this.rowsListCount[this.lrcInfo.index]-this.lrcNew[this.lrcInfo.index].rows+1})`);
                            let spans = elementLi.querySelectorAll('span');
                            spans.forEach(function(span) {
                                span.removeAttribute('style');
                            });
                            let elementB = elementLi.querySelector(`b:nth-child(1)`)
                            elementB.removeAttribute('style');
                        }
                    }else if (this.lyricsFlag === 3) {
                        if (this.elrcInfo.index < this.elrcNew.length) {
                            // nth-child从1开始
                            let elementLi = this.doms.ulelrc.querySelector(`li:nth-child(${this.rowsListCount[this.elrcInfo.index]-this.elrcNew[this.elrcInfo.index].rows+1})`);
                            let spans = elementLi.querySelectorAll('span');
                            spans.forEach(function(span) {
                                span.removeAttribute('style');
                            });
                        }
                    }
                    break;
                case 'Shift':
                    break;
                    // this.player.handlePlayAndPause()
                default:
                    break;
            }
        }, DEBOUNCE_DELAY);
    }

    updateLyrics(index){
        if (!this.lyricsEdit){
            return
        }
        // 构建请求的JSON数据
        var data = {
            id_value: this.id,
            title: this.title,
            elyrics: this.elrcStr,
            offset: this.offset,
            filename: this.filename
        };

        var title = this.title
        var offset = this.offset
        // 使用fetch发送POST请求
        fetch('http://localhost:5000/lyrics/update', {
            method: 'POST', // 设置请求方法为POST
            headers: {
                'Content-Type': 'application/json' // 设置请求头，指定发送的数据类型为JSON
            },
            body: JSON.stringify(data) // 将数据转换为JSON字符串作为请求体
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); // 解析JSON响应
        })
        .then(data => {
            // 将搜索结果显示到页面上
            if (data["code"] == 200) {
                let color = data["color"];
                if (color !== null) {
                    document.querySelectorAll('.music__list_content .music__list__item')[index].style.color=color
                }
                toast("《"+title+"》offset: "+offset, color)
            }else{
                alert(data["message"])
            }
        })
        .catch(error => {
            console.error('There has been a problem with your fetch operation:', error);
        });
    }
}




// 使用 fetch 获取远程文件内容
function getLyric(url) {
    fetch(url)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text(); // 假设服务器返回的是文本内容
    })
    .then(data => {
        // 获取到的歌词文本
        new LrcHandler(data)
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
    });
}






// 调用函数并传入请求的 URL
// getLyric('http://localhost:5000/lyrics/徐良, 阿悄 - 红装.lrc');
