#!/bin/bash
cd /home/z/my-project
rm -f dev.log
exec node node_modules/.bin/next dev -p 3000 2>&1 | tee dev.log
