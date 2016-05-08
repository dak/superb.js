gulp = require('gulp');
babel = require('gulp-babel');
rollup = require('gulp-rollup');
rollupIncludePaths = require('rollup-plugin-includepaths');
util = require('gulp-util');

function compile() {
    return gulp.src('superb.js', {
        since: gulp.lastRun('compile')
    })
    .pipe(rollup({
        plugins: [
            rollupIncludePaths({
                paths: ['src']
            })
        ]
    }))
    .pipe(babel({
        presets: ['es2015']
    }))
    .on('error', util.log)
    .pipe(gulp.dest('dist'));
}

gulp.task(compile);
