#!/bin/bash
cd /home/z/my-project
rm -f dev.log
# Double-fork to fully detach from the calling shell
(setsid node node_modules/.bin/next dev -p 3000 > dev.log 2>&1 &)
