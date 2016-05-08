var gulp = require('gulp');
require('require-dir')('./gulp/tasks', {recurse: true});

gulp.task('default', gulp.series(
    'compile'
));

gulp.task('build', gulp.series('default'));
gulp.task('dist', gulp.series('default'));
