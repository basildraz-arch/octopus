
FF="C:/Users/LOGO/AppData/Local/Programs/Python/Python315/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
cd C:/Users/LOGO/Desktop/octopus/marketing/reel
for f in owner1_t hebr1_t owner2_t hebr2_t hebr3_t; do
  "$FF" -i $f.wav 2>&1 | grep Duration | sed "s/^/$f /"
done
