#!/bin/bash

echo "🚀 Setting up Bandwidth Budget Tracker project structure..."

PROJECT_NAME="bandwidth-budget-tracker"
mkdir -p $PROJECT_NAME
cd $PROJECT_NAME || exit 1

mkdir -p src/{background,content,popup,options,utils}
mkdir -p src/assets/{icons,images}
mkdir -p src/styles
mkdir -p src/components

echo "✅ Project structure created successfully"
