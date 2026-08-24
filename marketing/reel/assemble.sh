#!/bin/bash
FF="C:/Users/LOGO/AppData/Local/Programs/Python/Python315/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
REEL="C:/Users/LOGO/Desktop/octopus/marketing/reel"

cd "$REEL"

# 1) silent video from frames
"$FF" -y -framerate 30 -i frames/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 20 video_silent.mp4 2>/dev/null

# 2) build 16s audio timeline with adelay + amix, bubbles sfx skipped (no asset), music none per brief? user wants calm music -18dB; we have no music asset -> use very quiet generated tone? Skip music (no asset), keep voices only.
# Voice placement (trimmed wavs): owner1@1.0 hebr1@6.05 owner2@7.05 hebr2@9.0 hebr3@10.1
"$FF" -y \
 -i owner1_t.wav -i hebr1_t.wav -i owner2_t.wav -i hebr2_t.wav -i hebr3_t.wav \
 -filter_complex "[0:a]adelay=1000|1000[v0];[1:a]adelay=6050|6050[v1];[2:a]adelay=7050|7050[v2];[3:a]adelay=9000|9000[v3];[4:a]adelay=10100|10100[v4];[v0][v1][v2][v3][v4]amix=inputs=5:normalize=0,apad=whole_dur=16[a]" \
 -map "[a]" -ar 44100 audio_timeline.wav 2>/dev/null

# 3) mux
"$FF" -y -i video_silent.mp4 -i audio_timeline.wav -c:v copy -c:a aac -b:a 128k -shortest "reel_okhtobot_16s.mp4" 2>/dev/null

"$FF" -i reel_okhtobot_16s.mp4 2>&1 | grep -E "Duration|Stream"
echo DONE
