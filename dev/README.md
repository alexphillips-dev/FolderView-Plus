# DEV Guide

## File names
The file names need to follow this pattern `SOMETHING.TAB_NAME.(js/css)`.
Where `SOMETHING` is replaced by any string, anything you like.
Where `TAB_NAME` is one of those values:
 - `dashboard`
 - `docker`
 - `vm`

You can use a file on multiple tabs by chaining those names with a `-` in between.
DO NOT remove the `.` those are needed.

Example
```javascript
    custom.dashboard.css // Will only work on the dashboard
    custom.docker.css // Will only work on the docker tab
    custom.vm.css // Will only work on the vms tab
    custom.dashboard-docker.css // Will work on the dashboard and docker tabs
    custom.dashboard-vm.css // Will work on the dashboard and vms tabs
    custom.dashboard-docker-vm.css // Will work on the dashboard,docker and vms tabs

    custom.dashboard.js // Will only work on the dashboard
    custom.docker.js // Will only work on the docker tab
    custom.vm.js // Will only work on the vms tab
    custom.dashboard-docker.js // Will work on the dashboard and docker tabs
    custom.dashboard-vm.js // Will work on the dashboard and vms tabs
    custom.dashboard-docker-vm.js // Will work on the dashboard,docker and vms tabs

    0.custom.dashboard.css // Will only work on the dashboard
    custom-dashboard.css // Will not work
    
```

## CSS
The file you want to edit is in `/boot/config/plugins/folderview.plus/styles`, it's plain CSS, so you will need to know CSS before doing something.

You can find the template used for creating the folder here, ([Dashboard](./dashboard/tab.html), [Docker](./docker/tab.html), [VMs](./vms/tab.html)), you can't change the template.html because it is hard-coded into the plugin, so any visual modification should be done trough CSS.

You can find the default styles here, ([Dashboard](../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css), [Docker](../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css), [VMs](../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css)).

This is it, have fun.

## JS
The file you want to edit is in `/boot/config/plugins/folderview.plus/scripts`, it's plain JavaScript, so you will need to know JavaScript before doing something.

You can find the template used for creating custom plugins here, ([Dashboard](./dashboard/events.js), [Docker](./docker/events.js), [VMs](./vms/events.js)).

You can remove the comments when you are done, thay are there just for documentation.

