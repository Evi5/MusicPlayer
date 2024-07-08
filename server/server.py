import os
from mutagen.flac import FLAC
from mutagen.mp4 import MP4, MP4Cover
from mutagen.id3 import ID3
from flask import Flask, jsonify, send_file, request, make_response
from flask_cors import CORS
from urllib.parse import unquote
import re

file_dir = os.path.join(os.getcwd(), "datas/music")
cover_dir = os.path.join(os.getcwd(), "datas/covers")
lyrics_dir = os.path.join(os.getcwd(), "datas/lyrics")
lyrics_new_dir = os.path.join(os.getcwd(), "datas/lyrics_new")

app = Flask(__name__)
CORS(app)


def get_suffix_of_cover(cover_data):
	suffix = ""
	if cover_data:
		# 检查前几个字节来识别图像格式
		if cover_data.startswith(b"\xFF\xD8"):
			suffix = "jpg"
		elif cover_data.startswith(b"\x89\x50\x4E\x47\x0D\x0A\x1A\x0A"):
			suffix = "png"
		else:
			raise MyCustomError("Cover image format: Unknown")
	else:
		raise MyCustomError("No cover image found.")
	return suffix

def save_cover_image(cover_data, cover_path):
	if not os.path.exists(cover_path):
		with open(cover_path, "wb") as f:
			f.write(cover_data)
	# print(cover_path)

def read_metadata(file_path, file_dir, cover_dir, lyrics_dir, id_val):
	_, file_extension = os.path.splitext(file_path)

	if file_extension.lower() == ".flac":
		try:
			audio = FLAC(file_path)
			# print(audio)
			artist = audio.get("artist")
			title = audio.get("title")
			cover = audio.pictures[0] if audio.pictures else None
			# 计算 cover 数据的 MD5 值
			cover_data = cover.data if cover else None
			lyrics = audio.get("lyrics")[0] if audio.get("lyrics") else None
		except ImportError:
			print("Error: Mutagen library does not support FLAC.")
			return None
	elif file_extension.lower() == ".mp3":
		try:
			audio = ID3(file_path)
			# print(audio)
			artist = audio.get("TPE1")
			title = audio.get("TIT2")
			cover = audio.get("APIC:") if audio.get("APIC:") else (audio.get("APIC:Cover") if audio.get("APIC:Cover") else audio.get("APIC:yyfm"))
			# 计算 cover 数据的 MD5 值
			cover_data = cover.data if cover else None
			lyrics = audio.get("USLT::eng").text if audio.get("USLT::eng") else None
			if audio.get("USLT::eng"):
				lyrics = audio.get("USLT::eng").text
			elif audio.get("USLT::XXX"):
				lyrics = audio.get("USLT::XXX").text
			elif audio.get("USLT::zho"):
				lyrics = audio.get("USLT::zho").text
			else:
				lyrics = None
		except ImportError:
			print(audio)
			print("Error: Mutagen library does not support MP3.")
			return None
	elif file_extension.lower() == ".m4a":
		try:
			audio = MP4(file_path)
			artist = audio.get("\xa9ART")
			title = audio.get("\xa9nam")
			cover = audio.tags.get("covr")
			cover = cover[0] if cover else None
			cover_data = cover if isinstance(cover, MP4Cover) else None
			if cover_data:
				# cover_data for .m4a
				cover_data = cover_data if cover_data.imageformat == MP4Cover.FORMAT_JPEG else cover_data
				cover_data = cover_data if cover_data.imageformat == MP4Cover.FORMAT_PNG else cover_data
				if not cover_data:
					raise MyCustomError("Error: Unrecognized cover format.")
			lyrics = audio.get("\xa9lyr")[0] if audio.get("\xa9lyr") else None
		except ImportError:
			print("Error: Mutagen library does not support M4A.")
			return None
	else:
		raise MyCustomError("Error: Unsupported file format.")
		return None

	if not artist or not title:
		raise MyCustomError("Error: Cant find metadata.")

	file_name_no_suffix = os.path.splitext(os.path.basename(file_path))[0]

	cover_path = cover_dir
	if cover:
		cover_path = os.path.join(cover_dir, file_name_no_suffix+"."+get_suffix_of_cover(cover_data))
		if not os.path.exists(cover_path):
			save_cover_image(cover_data, cover_path)
	else:
		raise MyCustomError("Error: Cant find metadata.cover")

	lyrics_path = os.path.join(lyrics_dir, file_name_no_suffix+".lrc")
	if not os.path.exists(lyrics_path):
		with open(lyrics_path, 'w') as file:
			file.write(lyrics)

	file_name=os.path.basename(file_path),
	artist=artist[0] if artist else None,
	title=title[0] if title else None,

	return {
		"id": id_val,
		"title": title[0],
		"singer": artist[0],
		"offset": 0,
		"lyricsUrl": lyrics_path.replace(lyrics_dir, "http://localhost:5000/lyrics"),
		"songUrl": file_path.replace(file_dir, "http://localhost:5000/play"),
		"imageUrl": cover_path.replace(cover_dir, "http://localhost:5000/cover"),
	}


def timestamp_to_milliseconds(time_str):
	# 正则表达式匹配小时、分钟和毫秒
	match = re.match(r'^(\d{2}):(\d{2})\.(\d{2,3})$', time_str)
	if match:
		# 从匹配对象中提取分钟、秒和毫秒
		minutes, seconds, milliseconds = match.groups()
		if len(milliseconds) == 2:
			milliseconds = int(milliseconds)
			milliseconds = milliseconds*10
		else:
			milliseconds = int(milliseconds)
		# 计算总毫秒数
		total_milliseconds = (int(minutes) * 60 + int(seconds))*1000 + milliseconds
		return total_milliseconds
	else:
		raise ValueError("时间格式不正确，应为 HH:MM.SS 的形式")

def milliseconds_to_timestamp(milliseconds):
	if milliseconds < 0:
		milliseconds = 0
	minutes = milliseconds // (60*1000)
	seconds = milliseconds % (60*1000) // 1000
	milliseconds %= 1000
	return f'{minutes:02d}:{seconds:02d}.{milliseconds:03d}'

@app.route('/play/<path:filename>')
def play_music(filename):
	# 定义文件的存放路径
	print("play", filename)
	file_path = os.path.join(file_dir, filename)
	# 使用 send_file 来安全地发送文件
	return send_file(file_path, as_attachment=True)

@app.route('/cover/<path:covername>')
def cover_music(covername):
	# 定义文件的存放路径
	print("cover", covername)
	file_path = os.path.join(cover_dir, covername)
	# 使用 send_file 来安全地发送文件
	return send_file(file_path, as_attachment=True)

@app.route('/lyrics/<path:lyricsname>')
def lyrics_music(lyricsname):
	# 定义文件的存放路径
	print("lyrics", lyricsname)
	file_path = os.path.join(lyrics_dir, lyricsname)
	return send_file(file_path, as_attachment=True)

@app.route('/getAllMusicInfo')
def get_all_music_info():
	music_list = []
	id_val = 0
	for root, _, files in os.walk(file_dir):
		for file in files:
			if file.endswith('.m4a') or file.endswith('.flac') or file.endswith('.mp3'):
				if file.startswith('.'):
					continue
				file_path = os.path.join(root, file)
				item = read_metadata(file_path, file_dir, cover_dir, lyrics_dir, id_val)
				id_val += 1
				music_list.append(item)
	return jsonify(music_list)

@app.route('/lyrics/update', methods=['POST'])  # 允许GET和POST请求
def update():
	if request.method == 'POST':
		code = 200
		# 解析JSON请求体
		data = request.get_json()
		id_value = data.get('id_value')
		title = data.get('title')
		offset = int(float(data.get('offset'))*1000)
		elyrics = data.get('elyrics')
		filename_with_suffix = unquote(data.get('filename'))
		filename = os.path.splitext(filename_with_suffix)[0]
		lines = elyrics.split("\n")
		lst = []
		for line in lines:
			line = line.strip()
			head_str = replace_start_timestamp(line, offset)
			new_line = replace_and_adjust_timestamps(head_str, offset)
			lst.append(new_line)
		lyrics_path = os.path.join(lyrics_new_dir, filename+".lrc")
		with open(lyrics_path, 'w') as file:
			file.write("\n".join(lst))
		color = None
		if offset == 404:
			color = "red"
		elif (float(offset) == 0):
			color = "lime"
		elif (float(offset) > 0):
			color = "#95F925"
		elif (float(offset) < 0):
			color = "#25F9EC"
		# 处理查询，返回结果
		return jsonify({'code':code, 'message': 'successed!', 'color': color})


def replace_start_timestamp(input_str, offset):
	# 匹配以 [HH:MM.SS] 格式开头的时间戳
	timestamp_pattern = r'^\[(\d{2}):(\d{2})\.(\d{2,3})\]'
	match = re.match(timestamp_pattern, input_str)

	if match:
		minutes, seconds, milliseconds = match.groups()
		# 转换为毫秒数
		current_ms = timestamp_to_milliseconds(f'{minutes}:{seconds}.{milliseconds}')
		# 加上 offset 毫秒
		new_ms = current_ms - offset
		# 转换回时间戳格式
		new_timestamp = milliseconds_to_timestamp(new_ms)
		# 替换原字符串中的时间戳
		return re.sub(timestamp_pattern, '['+new_timestamp+']', input_str, count=1)
	else:
		# 如果没有匹配，返回原始字符串
		return input_str

def replace_and_adjust_timestamps(input_str, offset):
	# 匹配所有符合 [HH:MM.SS] 格式的时间戳
	timestamp_pattern = r'<(\d{2}):(\d{2})\.(\d{2,3})>'
	matches = re.findall(timestamp_pattern, input_str)

	# 替换字符串中的时间戳
	for minutes, seconds, milliseconds in matches:
		# 转换为毫秒数
		current_ms = timestamp_to_milliseconds(f'{minutes}:{seconds}.{milliseconds}')
		# 减去 offset 毫秒
		new_ms = current_ms - offset
		# 转换回时间戳格式
		new_timestamp = milliseconds_to_timestamp(new_ms)
		# 替换原字符串中的时间戳
		input_str = re.sub('<' + re.escape(f'{minutes}:{seconds}.{milliseconds}') + '>', '<'+new_timestamp+'>', input_str)

	return input_str

if __name__ == '__main__':
	for path in [file_dir, lyrics_dir, cover_dir, lyrics_new_dir]:
		print(path)
		if not os.path.exists(path):
			os.makedirs(path)
	app.run(debug=True)

