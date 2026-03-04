#!/bin/bash

CWD=`pwd`

rm -Rf $CWD/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/*
cp /usr/local/emhttp/plugins/folderview.plus/* $CWD/src/folderview.plus/usr/local/emhttp/plugins/folderview.plus -R -v -p
chmod -R 0755 ./
chown -R root:root ./
