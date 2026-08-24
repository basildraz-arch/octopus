
FF="C:/Users/LOGO/AppData/Local/Programs/Python/Python315/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
cd C:/Users/LOGO/Desktop/octopus/marketing/reel
for f in owner1 hebr1 owner2 hebr2 hebr3; do
  "$FF" -y -i $f.mp3 -af "silenceremove=start_periods=1:start_threshold=-45dB:detection=peak,areverse,silenceremove=start_periods=1:start_threshold=-45dB:detection=peak,areverse" ${f}_t.wav 2>/dev/null
done
for f in owner1_t hebr1_t owner2_t hebr2_t hebr3_t; do
  d=$("$FF" -i $f.wav 2>&1 | grep Duration | sed 's/.*: //; s/,.*//')
  echo "$f $d"
done
